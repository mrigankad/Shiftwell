use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const TRAY_ID: &str = "main";

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

/// SHIFTWELL_REPO, else the nearest ancestor of the executable (or cwd) that contains the built daemon.
fn find_repo() -> Option<PathBuf> {
    let has = |p: &Path| p.join("apps/daemon/dist/server.js").exists();
    if let Ok(r) = std::env::var("SHIFTWELL_REPO") {
        let p = PathBuf::from(r);
        return if has(&p) { Some(p) } else { None };
    }
    let starts = [std::env::current_exe().ok(), std::env::current_dir().ok()];
    for s in starts.into_iter().flatten() {
        for a in s.ancestors() {
            if has(a) {
                return Some(a.to_path_buf());
            }
        }
    }
    None
}

fn spawn_daemon() -> Result<Child, String> {
    let repo = find_repo().ok_or("Could not find the Shiftwell daemon (apps/daemon/dist/server.js). Build it with `pnpm -r build` and set SHIFTWELL_REPO to the repository folder.")?;
    let server = repo.join("apps/daemon/dist/server.js");
    let mut cmd = Command::new("node");
    cmd.arg(&server)
        .current_dir(&repo)
        .env("SHIFTWELL_PORT", port().to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.spawn()
        .map_err(|e| format!("Could not start Node ({e}). Install Node 22 and make sure `node` is on PATH."))
}

/// Make sure a daemon answers; Err carries a user-facing message.
fn ensure_daemon(app: &AppHandle) -> Result<(), String> {
    if healthy() {
        return Ok(());
    }
    let child = spawn_daemon()?;
    *app.state::<Daemon>().0.lock().unwrap() = Some(child);
    for _ in 0..40 {
        thread::sleep(Duration::from_millis(250));
        if healthy() {
            return Ok(());
        }
        if let Some(c) = app.state::<Daemon>().0.lock().unwrap().as_mut() {
            if let Ok(Some(st)) = c.try_wait() {
                return Err(format!("The Shiftwell daemon exited right away ({st})."));
            }
        }
    }
    Err("The Shiftwell daemon did not answer within 10 seconds.".into())
}

fn encode(s: &str) -> String {
    s.bytes()
        .map(|b| if b.is_ascii_alphanumeric() { (b as char).to_string() } else { format!("%{b:02X}") })
        .collect()
}

fn create_window(app: &AppHandle, ok: Result<(), String>) {
    let url = match &ok {
        Ok(()) => WebviewUrl::External(base().parse().unwrap()),
        Err(m) => WebviewUrl::App(format!("error.html?{}", encode(m)).into()),
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

/// (status line, optional handoff "from", "to")
fn fetch_status() -> (String, Option<(String, String)>) {
    let v: serde_json::Value = match agent()
        .get(&format!("{}/api/board", base()))
        .call()
        .map_err(|e| e.to_string())
        .and_then(|r| r.into_json().map_err(|e| e.to_string()))
    {
        Ok(v) => v,
        Err(_) => return ("Daemon not reachable".into(), None),
    };
    let accounts = v["accounts"].as_array().cloned().unwrap_or_default();
    let room = accounts.iter().filter(|a| a["usage"]["state"] == "room").count();
    let active = v["runs"].as_array().map(|r| r.iter().filter(|x| x["status"] == "active").count()).unwrap_or(0);
    let status = format!("{} accounts, {} with room, {} active runs", accounts.len(), room, active);
    let hand = v["suggestions"]
        .as_array()
        .and_then(|s| s.first())
        .and_then(|s| Some((s["from"].as_str()?.to_string(), s["to"].as_str()?.to_string())));
    (status, hand)
}

fn build_menu(app: &AppHandle, status: &str, hand: &Option<(String, String)>) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    menu.append(&MenuItem::with_id(app, "open", "Open Shiftwell", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "status", status, false, None::<&str>)?)?;
    if let Some((f, t)) = hand {
        menu.append(&MenuItem::with_id(app, "handoff", format!("Handoff suggested: {f} to {t}"), true, None::<&str>)?)?;
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;
    Ok(menu)
}

fn refresh_tray(app: &AppHandle) {
    let (status, hand) = fetch_status();
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), build_menu(app, &status, &hand)) {
        let _ = tray.set_menu(Some(menu));
        let _ = tray.set_tooltip(Some(format!("Shiftwell: {status}")));
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        .manage(Daemon(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            let menu = build_menu(&handle, "Starting...", &None)?;
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Shiftwell")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, ev| match ev.id.as_ref() {
                    "open" => show_window(app, None),
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
                create_window(&handle, res);
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
