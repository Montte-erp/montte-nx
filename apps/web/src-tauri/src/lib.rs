#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    configure_linux_desktop_environment();

    tauri::Builder::default()
        .setup(|app| {
            configure_main_window(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Montte desktop shell");
}

#[cfg(target_os = "linux")]
fn configure_linux_desktop_environment() {
    if std::env::var_os("GDK_BACKEND").is_none() && is_wayland_session() {
        std::env::set_var("GDK_BACKEND", "wayland,x11");
    }

    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() && is_hyprland_session() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

#[cfg(not(target_os = "linux"))]
fn configure_linux_desktop_environment() {}

#[cfg(target_os = "linux")]
fn configure_main_window(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri::Manager;

    if !is_hyprland_session() {
        return Ok(());
    }

    if let Some(window) = app.get_webview_window("main") {
        window.set_decorations(false)?;
    }

    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn configure_main_window(_app: &mut tauri::App) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "linux")]
fn is_wayland_session() -> bool {
    std::env::var_os("WAYLAND_DISPLAY").is_some()
        || std::env::var("XDG_SESSION_TYPE").is_ok_and(|value| value == "wayland")
}

#[cfg(target_os = "linux")]
fn is_hyprland_session() -> bool {
    std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some()
        || std::env::var("XDG_CURRENT_DESKTOP")
            .is_ok_and(|value| value.to_lowercase().contains("hyprland"))
}
