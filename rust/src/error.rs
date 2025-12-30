//! Error types for the terminal plugin.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Result type for terminal operations.
pub type Result<T> = std::result::Result<T, Error>;

/// Errors that can occur in the terminal plugin.
#[derive(Debug, Error)]
pub enum Error {
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session already exists: {0}")]
    SessionAlreadyExists(String),

    #[error("PTY error: {0}")]
    PtyError(String),

    #[error("Terminal error: {0}")]
    TerminalError(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Session is closed")]
    SessionClosed,

    #[error("Lock poisoned")]
    LockPoisoned,
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::IoError(e.to_string())
    }
}


// Make Error serializable for Tauri
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for Error {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(Error::TerminalError(s))
    }
}
