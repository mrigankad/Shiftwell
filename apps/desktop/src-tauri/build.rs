fn main() {
    println!("cargo:rerun-if-env-changed=SHIFTWELL_REPO_DEFAULT");
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["choose_repo"])),
    )
    .expect("failed to run tauri-build");
}
