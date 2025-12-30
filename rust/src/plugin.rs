//! Tauri plugin implementation.

use crate::commands::*;
use crate::events::{event_channel, EventReceiver};
use crate::session::SessionManager;
use std::sync::Arc;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Emitter, Manager, Runtime,
};
use tokio::time::{interval, Duration};

/// Initialize the terminal plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("terminal")
        .invoke_handler(tauri::generate_handler![
            create_session,
            destroy_session,
            list_sessions,
            get_session,
            write_to_session,
            write_bytes_to_session,
            resize_session,
            get_screen,
            poll_session,
            get_theme,
            set_theme,
            list_themes,
            get_session_count,
        ])
        .setup(|app, _api| {
            let (event_sender, event_receiver) = event_channel();
            let manager = Arc::new(SessionManager::new(event_sender));

            // Store state
            app.manage(TerminalState {
                manager: manager.clone(),
            });

            // Start background tasks
            let app_handle = app.clone();
            let manager_clone = manager.clone();

            // Spawn event forwarding task
            tauri::async_runtime::spawn(async move {
                forward_events(app_handle, event_receiver).await;
            });

            // Spawn output polling task
            let app_handle2 = app.clone();
            tauri::async_runtime::spawn(async move {
                poll_output(app_handle2, manager_clone).await;
            });

            Ok(())
        })
        .build()
}

/// Forward terminal events to the frontend via Tauri events.
async fn forward_events<R: Runtime>(app: tauri::AppHandle<R>, mut receiver: EventReceiver) {
    while let Some(event) = receiver.recv().await {
        let event_name = event.event_name();
        if let Err(e) = app.emit(event_name, &event) {
            log::error!("Failed to emit event {}: {}", event_name, e);
        }
    }
}

/// Poll for PTY output and emit screen updates.
async fn poll_output<R: Runtime>(_app: tauri::AppHandle<R>, manager: Arc<SessionManager>) {
    let mut ticker = interval(Duration::from_millis(16)); // ~60fps

    loop {
        ticker.tick().await;

        // Process all sessions
        manager.process_all();

        // Clean up dead sessions periodically
        manager.cleanup_dead();
    }
}
