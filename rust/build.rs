//! Build script for tauri-plugin-terminal.

const COMMANDS: &[&str] = &[
    "create_session",
    "destroy_session",
    "list_sessions",
    "get_session",
    "write_to_session",
    "write_bytes_to_session",
    "resize_session",
    "get_screen",
    "poll_session",
    "get_theme",
    "set_theme",
    "list_themes",
    "get_session_count",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
