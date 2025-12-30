//! Event types emitted by the terminal plugin.

use crate::types::{Cursor, Mark, ScreenUpdate};
use serde::{Deserialize, Serialize};

/// Events emitted by the terminal plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TerminalEvent {
    /// Session was created.
    SessionCreated {
        session_id: String,
    },

    /// Session was destroyed.
    SessionDestroyed {
        session_id: String,
    },

    /// Terminal was resized.
    TerminalResized {
        session_id: String,
        cols: u16,
        rows: u16,
    },

    /// Screen content was updated.
    ScreenUpdate(ScreenUpdate),

    /// Full screen refresh (sent on reconnect).
    ScreenRefresh {
        session_id: String,
        /// Base64 encoded full screen
        screen: String,
    },

    /// Terminal bell.
    Bell {
        session_id: String,
    },

    /// Window title changed.
    TitleChange {
        session_id: String,
        title: String,
    },

    /// Current working directory changed.
    DirectoryChange {
        session_id: String,
        cwd: String,
    },

    /// Shell integration mark.
    Mark {
        session_id: String,
        mark: Mark,
    },

    /// Process exited.
    ProcessExit {
        session_id: String,
        exit_code: Option<i32>,
    },

    /// Cursor position changed.
    CursorMove {
        session_id: String,
        cursor: Cursor,
    },

    /// Selection changed.
    SelectionChange {
        session_id: String,
        /// Selected text, if any.
        text: Option<String>,
    },

    /// Clipboard request (OSC 52).
    ClipboardRequest {
        session_id: String,
        /// Base64 encoded content.
        content: String,
    },

    /// Hyperlink detected.
    Hyperlink {
        session_id: String,
        url: String,
        row: u16,
        start_col: u16,
        end_col: u16,
    },
}

impl TerminalEvent {
    /// Get the session ID for this event.
    pub fn session_id(&self) -> &str {
        match self {
            Self::SessionCreated { session_id } => session_id,
            Self::SessionDestroyed { session_id } => session_id,
            Self::TerminalResized { session_id, .. } => session_id,
            Self::ScreenUpdate(update) => &update.session_id,
            Self::ScreenRefresh { session_id, .. } => session_id,
            Self::Bell { session_id } => session_id,
            Self::TitleChange { session_id, .. } => session_id,
            Self::DirectoryChange { session_id, .. } => session_id,
            Self::Mark { session_id, .. } => session_id,
            Self::ProcessExit { session_id, .. } => session_id,
            Self::CursorMove { session_id, .. } => session_id,
            Self::SelectionChange { session_id, .. } => session_id,
            Self::ClipboardRequest { session_id, .. } => session_id,
            Self::Hyperlink { session_id, .. } => session_id,
        }
    }

    /// Get the event name for Tauri event emission.
    pub fn event_name(&self) -> &'static str {
        match self {
            Self::SessionCreated { .. } => "terminal://session-created",
            Self::SessionDestroyed { .. } => "terminal://session-destroyed",
            Self::TerminalResized { .. } => "terminal://terminal-resized",
            Self::ScreenUpdate { .. } => "terminal://screen-update",
            Self::ScreenRefresh { .. } => "terminal://screen-refresh",
            Self::Bell { .. } => "terminal://bell",
            Self::TitleChange { .. } => "terminal://title-change",
            Self::DirectoryChange { .. } => "terminal://directory-change",
            Self::Mark { .. } => "terminal://mark",
            Self::ProcessExit { .. } => "terminal://process-exit",
            Self::CursorMove { .. } => "terminal://cursor-move",
            Self::SelectionChange { .. } => "terminal://selection-change",
            Self::ClipboardRequest { .. } => "terminal://clipboard-request",
            Self::Hyperlink { .. } => "terminal://hyperlink",
        }
    }
}

/// Event channel for emitting terminal events.
pub type EventSender = tokio::sync::mpsc::UnboundedSender<TerminalEvent>;
pub type EventReceiver = tokio::sync::mpsc::UnboundedReceiver<TerminalEvent>;

/// Create a new event channel.
pub fn event_channel() -> (EventSender, EventReceiver) {
    tokio::sync::mpsc::unbounded_channel()
}
