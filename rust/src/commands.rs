//! Tauri commands for the terminal plugin.

use crate::error::Result;
use crate::session::{SessionConfig, SessionId, SessionInfo, SessionManager};
use crate::theme::Theme;
use crate::types::{Screen, ScreenUpdate};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{command, AppHandle, Runtime, State};

/// Plugin state.
pub struct TerminalState {
    pub manager: Arc<SessionManager>,
}

/// Create a new terminal session.
#[command]
pub async fn create_session<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    config: SessionConfig,
) -> Result<SessionId> {
    state.manager.create(config)
}

/// Destroy a terminal session.
#[command]
pub async fn destroy_session<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
) -> Result<()> {
    state.manager.destroy(&session_id)
}

/// List all sessions.
#[command]
pub async fn list_sessions<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
) -> Result<Vec<SessionInfo>> {
    Ok(state.manager.list())
}

/// Get session info.
#[command]
pub async fn get_session<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
) -> Result<SessionInfo> {
    state.manager.get_info(&session_id)
}

/// Write data to a session.
#[command]
pub async fn write_to_session<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
    data: String,
) -> Result<()> {
    state.manager.write(&session_id, data.as_bytes())
}

/// Write binary data to a session.
#[command]
pub async fn write_bytes_to_session<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<()> {
    state.manager.write(&session_id, &data)
}

/// Resize a session.
#[command]
pub async fn resize_session<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<()> {
    state.manager.resize(&session_id, cols, rows)
}

/// Get the full screen state.
#[command]
pub async fn get_screen<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
) -> Result<Screen> {
    state.manager.get_screen(&session_id)
}

/// Process pending output for a session and get updates.
#[command]
pub async fn poll_session<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
) -> Result<Option<ScreenUpdate>> {
    state.manager.process(&session_id)
}

/// Get the theme for a session.
#[command]
pub async fn get_theme<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
) -> Result<Theme> {
    state.manager.get_theme(&session_id)
}

/// Set the theme for a session.
#[command]
pub async fn set_theme<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
    session_id: String,
    theme_name: String,
) -> Result<()> {
    state.manager.set_theme(&session_id, &theme_name)
}

/// List available themes.
#[command]
pub async fn list_themes<R: Runtime>(_app: AppHandle<R>) -> Result<Vec<String>> {
    Ok(crate::theme::THEMES.iter().map(|(n, _)| n.to_string()).collect())
}

/// Get the session count.
#[command]
pub async fn get_session_count<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, TerminalState>,
) -> Result<usize> {
    Ok(state.manager.count())
}
