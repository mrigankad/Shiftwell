use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_opener::OpenerExt as _;

const TRAY_ID: &str = "main";

#[cfg(target_os = "macos")]
const AUTOSTART_LABEL: &str = "Open at login";
#[cfg(not(target_os = "macos"))]
const AUTOSTART_LABEL: &str = "Start with Windows";

const ICON_NORMAL: &[u8] = include_bytes!("../icons/tray/normal.png");
const ICON_ATTENTION: &[u8] = include_bytes!("../icons/tray/attention.png");
const ICON_OUT: &[u8] = include_bytes!("../icons/tray/out.png");

/// Crew state shown by the tray icon.
#[derive(Clone, Copy, PartialEq)]
enum Level {
    Normal = 0,
    Attention = 1,
    Out = 2,
}

/// Menu items that are updated in place on every refresh (no set_menu, so no flicker).
struct TrayItems {
    status: MenuItem<tauri::Wry>,
    handoff: MenuItem<tauri::Wry>,
    level: AtomicU8,
}

struct Status {
    line: String,
    hand: Option<(String, String)>,
    level: Level,
}

/// The daemon child, only set when this app started it.
struct Daemon(Mutex<Option<Child>>);

fn port() -> u16 {
    std::env::var("SHIFTWELL_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(4520)
}
fn base() -> String {
    format!("http://127.0.0.1:{}", port())
}
fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().timeout(Duration::from_secs(3)).build()
}
fn healthy() -> bool {
    agent().get(&format!("{}/api/health", base())).call().is_ok()
}

const DEFAULT_REPO: Option<&str> = option_env!("SHIFTWELL_REPO_DEFAULT");

fn has_daemon(p: &Path) -> bool {
    p.join("apps/daemon/dist/server.js").exists()
}

fn repo_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("repo.txt"))
}

fn save_repo(app: &AppHandle, repo: &Path) {
    if let Some(f) = repo_file(app) {
        if let Some(d) = f.parent() {
            let _ = std::fs::create_dir_all(d);
        }
        let _ = std::fs::write(f, repo.to_string_lossy().as_bytes());
    }
}

/// SHIFTWELL_REPO, else the saved path, else an ancestor of the executable (or cwd), else the build-time default.
/// A repo found this way is remembered in the app config dir.
fn find_repo(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(r) = std::env::var("SHIFTWELL_REPO") {
        let p = PathBuf::from(r);
        if has_daemon(&p) {
            save_repo(app, &p);
            return Some(p);
        }
        return None;
    }
    if let Some(f) = repo_file(app) {
        if let Ok(t) = std::fs::read_to_string(f) {
            let p = PathBuf::from(t.trim());
            if has_daemon(&p) {
                return Some(p);
            }
        }
    }
    let starts = [std::env::current_exe().ok(), std::env::current_dir().ok()];
    for s in starts.into_iter().flatten() {
        for a in s.ancestors() {
            if has_daemon(a) {
                save_repo(app, a);
                return Some(a.to_path_buf());
            }
        }
    }
    if let Some(d) = DEFAULT_REPO {
        let p = PathBuf::from(d);
        if has_daemon(&p) {
            save_repo(app, &p);
            return Some(p);
        }
    }
    None
}

fn node_command() -> Command {
    let mut cmd = Command::new("node");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd
}

fn has_node() -> bool {
    node_command()
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Startup failure; `kind` lets the error page pick its guidance and buttons.
struct Fail {
    kind: &'static str,
    msg: String,
}
fn fail(kind: &'static str, msg: impl Into<String>) -> Fail {
    Fail { kind, msg: msg.into() }
}

fn spawn_daemon(app: &AppHandle) -> Result<Child, Fail> {
    if !has_node() {
        return Err(fail("node", "Node.js was not found on PATH. Shiftwell needs Node 22 or newer to run its daemon."));
    }
    let repo = find_repo(app)
        .ok_or_else(|| fail("repo", "Could not find the Shiftwell folder (the one containing apps/daemon/dist/server.js)."))?;
    let server = repo.join("apps/daemon/dist/server.js");
    let mut cmd = node_command();
    cmd.arg(&server)
        .current_dir(&repo)
        .env("SHIFTWELL_PORT", port().to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    cmd.spawn().map_err(|e| fail("node", format!("Could not start Node ({e}). Install Node 22 and make sure `node` is on PATH.")))
}

/// Make sure a daemon answers; Err carries a user-facing message.
fn ensure_daemon(app: &AppHandle) -> Result<(), Fail> {
    if healthy() {
        return Ok(());
    }
    let child = spawn_daemon(app)?;
    *app.state::<Daemon>().0.lock().unwrap() = Some(child);
    for _ in 0..40 {
        thread::sleep(Duration::from_millis(250));
        if healthy() {
            return Ok(());
        }
        if let Some(c) = app.state::<Daemon>().0.lock().unwrap().as_mut() {
            if let Ok(Some(st)) = c.try_wait() {
                return Err(fail("other", format!("The Shiftwell daemon exited right away ({st}).")));
            }
        }
    }
    Err(fail("other", "The Shiftwell daemon did not answer within 10 seconds."))
}

fn encode(s: &str) -> String {
    s.bytes()
        .map(|b| if b.is_ascii_alphanumeric() { (b as char).to_string() } else { format!("%{b:02X}") })
        .collect()
}

fn create_window(app: &AppHandle, ok: &Result<(), Fail>) {
    let url = match ok {
        Ok(()) => WebviewUrl::External(base().parse().unwrap()),
        Err(f) => WebviewUrl::App(format!("error.html?k={}&m={}", f.kind, encode(&f.msg)).into()),
    };
    let w = WebviewWindowBuilder::new(app, "main", url)
        .title("Shiftwell")
        .inner_size(1280.0, 820.0)
        .min_inner_size(960.0, 640.0)
        .visible(false)
        .build();
    if let Ok(w) = w {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn show_window(app: &AppHandle, hash: Option<&str>) {
    if let Some(w) = app.get_webview_window("main") {
        if let Some(h) = hash {
            let _ = w.eval(&format!("window.location.hash = '{h}'"));
        }
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn toggle_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_window(app, None);
        }
    }
}

/// IPC for the error page: pick the repo folder, validate, remember it, start the daemon and load the app.
#[tauri::command]
async fn choose_repo(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app.dialog().file().set_title("Choose the Shiftwell folder").blocking_pick_folder();
    let Some(path) = picked else { return Ok(()) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    if !has_daemon(&path) {
        return Err("That folder does not contain apps/daemon/dist/server.js. Pick the Shiftwell repository folder and build it first with `pnpm -r build`.".into());
    }
    save_repo(&app, &path);
    let a = app.clone();
    tauri::async_runtime::spawn_blocking(move || ensure_daemon(&a).map_err(|f| f.msg))
        .await
        .map_err(|e| e.to_string())??;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval(&format!("window.location.replace('{}')", base()));
    }
    Ok(())
}

fn fetch_status() -> Status {
    let v: serde_json::Value = match agent()
        .get(&format!("{}/api/board", base()))
        .call()
        .map_err(|e| e.to_string())
        .and_then(|r| r.into_json().map_err(|e| e.to_string()))
    {
        Ok(v) => v,
        Err(_) => return Status { line: "Daemon not reachable".into(), hand: None, level: Level::Attention },
    };
    let accounts = v["accounts"].as_array().cloned().unwrap_or_default();
    let count = |st: &str| accounts.iter().filter(|a| a["usage"]["state"] == st).count();
    let (room, low, out) = (count("room"), count("low"), count("out"));
    let active = v["runs"].as_array().map(|r| r.iter().filter(|x| x["status"] == "active").count()).unwrap_or(0);
    let line = format!("{} accounts, {} with room, {} active runs", accounts.len(), room, active);
    let hand = v["suggestions"]
        .as_array()
        .and_then(|s| s.first())
        .and_then(|s| Some((s["from"].as_str()?.to_string(), s["to"].as_str()?.to_string())));
    let level = if out > 0 {
        Level::Out
    } else if low > 0 || hand.is_some() {
        Level::Attention
    } else {
        Level::Normal
    };
    Status { line, hand, level }
}

fn refresh_tray(app: &AppHandle) {
    let st = fetch_status();
    let items = app.state::<TrayItems>();
    let _ = items.status.set_text(&st.line);
    match &st.hand {
        Some((f, t)) => {
            let _ = items.handoff.set_text(format!("Handoff suggested: {f} to {t}"));
            let _ = items.handoff.set_enabled(true);
        }
        None => {
            let _ = items.handoff.set_text("No handoff suggested");
            let _ = items.handoff.set_enabled(false);
        }
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(format!("Shiftwell: {}", st.line)));
        if items.level.swap(st.level as u8, Ordering::Relaxed) != st.level as u8 {
            let bytes = match st.level {
                Level::Normal => ICON_NORMAL,
                Level::Attention => ICON_ATTENTION,
                Level::Out => ICON_OUT,
            };
            if let Ok(img) = Image::from_bytes(bytes) {
                let _ = tray.set_icon(Some(img));
            }
        }
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        // Must be registered first: a second launch focuses the existing window and exits.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_window(app, None)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![choose_repo])
        .manage(Daemon(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            let open = MenuItem::with_id(&handle, "open", "Open Shiftwell", true, None::<&str>)?;
            let browser = MenuItem::with_id(&handle, "browser", "Open dashboard in browser", true, None::<&str>)?;
            let status = MenuItem::with_id(&handle, "status", "Starting...", false, None::<&str>)?;
            let handoff = MenuItem::with_id(&handle, "handoff", "No handoff suggested", false, None::<&str>)?;
            let enabled = handle.autolaunch().is_enabled().unwrap_or(false);
            let autostart = CheckMenuItem::with_id(&handle, "autostart", AUTOSTART_LABEL, true, enabled, None::<&str>)?;
            let quit = MenuItem::with_id(&handle, "quit", "Quit", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(&handle)?;
            let sep2 = PredefinedMenuItem::separator(&handle)?;
            let menu = Menu::with_items(&handle, &[&open, &browser, &status, &handoff, &sep, &autostart, &sep2, &quit])?;
            app.manage(TrayItems { status, handoff, level: AtomicU8::new(Level::Normal as u8) });
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(Image::from_bytes(ICON_NORMAL)?)
                .tooltip("Shiftwell")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, ev| match ev.id.as_ref() {
                    "open" => show_window(app, None),
                    "browser" => {
                        let _ = app.opener().open_url(base(), None::<&str>);
                    }
                    "autostart" => {
                        let al = app.autolaunch();
                        let _ = if al.is_enabled().unwrap_or(false) { al.disable() } else { al.enable() };
                        let _ = autostart.set_checked(al.is_enabled().unwrap_or(false));
                    }
                    "handoff" => show_window(app, Some("/board")),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, ev| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;
            // Daemon start, window creation and the 30 s status refresh run off the main thread.
            thread::spawn(move || {
                let res = ensure_daemon(&handle);
                let ok = res.is_ok();
                create_window(&handle, &res);
                loop {
                    if ok {
                        refresh_tray(&handle);
                    }
                    thread::sleep(Duration::from_secs(30));
                }
            });
            Ok(())
        })
        .on_window_event(|w, ev| {
            if let WindowEvent::CloseRequested { api, .. } = ev {
                api.prevent_close();
                let _ = w.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build Shiftwell desktop");

    app.run(|handle, ev| {
        if let RunEvent::Exit = ev {
            if let Some(mut c) = handle.state::<Daemon>().0.lock().unwrap().take() {
                let _ = c.kill();
                let _ = c.wait();
            }
        }
    });
}
