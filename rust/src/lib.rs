//! # tauri-plugin-terminal
//!
//! A high-performance terminal plugin for Tauri applications.
//!
//! ## Features
//!
//! - **Rust-native state management** - Terminal state lives in Rust, not DOM
//! - **Session persistence** - Content survives component unmount/remount
//! - **Multi-session support** - Run multiple independent terminals
//! - **iTerm2/oh-my-zsh compatible** - Shell integration, marks, images
//! - **Canvas rendering** - GPU-accelerated, 60fps smooth scrolling
//!
//! ## Quick Start
//!
//! ```rust,ignore
//! use tauri_plugin_terminal::TerminalPlugin;
//!
//! fn main() {
//!     tauri::Builder::default()
//!         .plugin(tauri_plugin_terminal::init())
//!         .run(tauri::generate_context!())
//!         .expect("error while running tauri application");
//! }
//! ```

mod commands;
mod error;
mod events;
mod plugin;
mod pty;
mod session;
mod terminal;
mod theme;
mod types;

pub use error::{Error, Result};
pub use events::*;
pub use plugin::init;
pub use session::{Session, SessionConfig, SessionId, SessionInfo, SessionManager};
pub use terminal::Terminal;
pub use theme::{Theme, THEMES};
pub use types::*;

/// Re-export for convenience
pub use vt100;
