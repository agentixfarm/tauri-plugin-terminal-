//! Terminal session management.

use crate::error::{Error, Result};
use crate::events::{EventSender, TerminalEvent};
use crate::pty::{Pty, PtyConfig};
use crate::terminal::Terminal;
use crate::theme::Theme;
use crate::types::{Cursor, Mark, Screen, ScreenUpdate, Size};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Unique session identifier.
pub type SessionId = String;

/// Configuration for creating a new session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// Optional session ID (generated if not provided).
    #[serde(default)]
    pub id: Option<String>,
    /// Working directory.
    #[serde(default)]
    pub cwd: Option<String>,
    /// Shell to use.
    #[serde(default)]
    pub shell: Option<String>,
    /// Environment variables.
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Initial terminal size.
    #[serde(default)]
    pub cols: Option<u16>,
    #[serde(default)]
    pub rows: Option<u16>,
    /// Theme name.
    #[serde(default)]
    pub theme: Option<String>,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            id: None,
            cwd: None,
            shell: None,
            env: HashMap::new(),
            cols: Some(80),
            rows: Some(24),
            theme: None,
        }
    }
}

/// Information about a session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: SessionId,
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub title: String,
    pub size: Size,
    pub is_alive: bool,
    pub created_at: u64,
}

/// A terminal session combining PTY and terminal emulator.
pub struct Session {
    pub id: SessionId,
    terminal: Terminal,
    pty: Pty,
    theme: Theme,
    config: SessionConfig,
    event_sender: EventSender,
    created_at: u64,
    marks: Vec<Mark>,
}

impl Session {
    /// Create a new session.
    pub fn new(config: SessionConfig, event_sender: EventSender) -> Result<Self> {
        let id = config.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
        let cols = config.cols.unwrap_or(80);
        let rows = config.rows.unwrap_or(24);

        let terminal = Terminal::new(cols, rows);
        let pty = Pty::spawn(PtyConfig {
            cwd: config.cwd.clone(),
            shell: config.shell.clone(),
            env: config.env.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
            size: Size { cols, rows },
        })?;

        let theme = config
            .theme
            .as_ref()
            .and_then(|n| Theme::by_name(n))
            .unwrap_or_default();

        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        Ok(Self {
            id,
            terminal,
            pty,
            theme,
            config,
            event_sender,
            created_at,
            marks: Vec::new(),
        })
    }

    /// Get session info.
    pub fn info(&self) -> SessionInfo {
        SessionInfo {
            id: self.id.clone(),
            cwd: self.config.cwd.clone(),
            shell: self.config.shell.clone(),
            title: self.terminal.title().to_string(),
            size: self.terminal.size(),
            is_alive: self.pty.is_alive(),
            created_at: self.created_at,
        }
    }

    /// Write data to the session's PTY.
    pub fn write(&self, data: &[u8]) -> Result<()> {
        self.pty.write(data)
    }

    /// Resize the session.
    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<()> {
        self.terminal.resize(cols, rows);
        self.pty.resize(cols, rows)?;

        // Emit resize event to notify frontend
        let _ = self.event_sender.send(TerminalEvent::TerminalResized {
            session_id: self.id.clone(),
            cols,
            rows,
        });

        Ok(())
    }

    /// Get the full screen state.
    pub fn get_screen(&self) -> Screen {
        self.terminal.get_screen()
    }

    /// Get cursor state.
    pub fn get_cursor(&self) -> Cursor {
        self.terminal.get_cursor()
    }

    /// Get the theme.
    pub fn theme(&self) -> &Theme {
        &self.theme
    }

    /// Set the theme.
    pub fn set_theme(&mut self, theme: Theme) {
        self.theme = theme;
    }

    /// Check if session is alive.
    pub fn is_alive(&self) -> bool {
        self.pty.is_alive()
    }

    /// Process any available PTY output.
    /// Returns changes if any processing occurred.
    pub fn process_output(&mut self) -> Option<ScreenUpdate> {
        if let Some(data) = self.pty.try_read() {
            let changes = self.terminal.process(&data);

            if !changes.is_empty() {
                let update = ScreenUpdate {
                    session_id: self.id.clone(),
                    changes,
                    cursor: self.terminal.get_cursor(),
                    title: Some(self.terminal.title().to_string()),
                };

                // Emit event
                let _ = self.event_sender.send(TerminalEvent::ScreenUpdate(update.clone()));

                // Check for bell
                if self.terminal.check_bell() {
                    let _ = self.event_sender.send(TerminalEvent::Bell {
                        session_id: self.id.clone(),
                    });
                }

                return Some(update);
            }
        }

        None
    }

    /// Get marks.
    pub fn marks(&self) -> &[Mark] {
        &self.marks
    }

    /// Add a mark.
    pub fn add_mark(&mut self, mark: Mark) {
        self.marks.push(mark.clone());
        let _ = self.event_sender.send(TerminalEvent::Mark {
            session_id: self.id.clone(),
            mark,
        });
    }

    /// Kill the session.
    pub fn kill(&self) {
        self.pty.kill();
    }
}

/// Manages all terminal sessions.
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<SessionId, Session>>>,
    event_sender: EventSender,
}

impl SessionManager {
    /// Create a new session manager.
    pub fn new(event_sender: EventSender) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            event_sender,
        }
    }

    /// Create a new session.
    pub fn create(&self, config: SessionConfig) -> Result<SessionId> {
        let id = config.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());

        // Check if session already exists
        {
            let sessions = self.sessions.read();
            if sessions.contains_key(&id) {
                return Err(Error::SessionAlreadyExists(id));
            }
        }

        let mut config = config;
        config.id = Some(id.clone());

        let session = Session::new(config, self.event_sender.clone())?;

        {
            let mut sessions = self.sessions.write();
            sessions.insert(id.clone(), session);
        }

        // Emit event
        let _ = self.event_sender.send(TerminalEvent::SessionCreated {
            session_id: id.clone(),
        });

        Ok(id)
    }

    /// Destroy a session.
    pub fn destroy(&self, id: &str) -> Result<()> {
        let session = {
            let mut sessions = self.sessions.write();
            sessions.remove(id)
        };

        match session {
            Some(s) => {
                s.kill();
                let _ = self.event_sender.send(TerminalEvent::SessionDestroyed {
                    session_id: id.to_string(),
                });
                Ok(())
            }
            None => Err(Error::SessionNotFound(id.to_string())),
        }
    }

    /// Get session info.
    pub fn get_info(&self, id: &str) -> Result<SessionInfo> {
        let sessions = self.sessions.read();
        sessions
            .get(id)
            .map(|s| s.info())
            .ok_or_else(|| Error::SessionNotFound(id.to_string()))
    }

    /// List all sessions.
    pub fn list(&self) -> Vec<SessionInfo> {
        let sessions = self.sessions.read();
        sessions.values().map(|s| s.info()).collect()
    }

    /// Write to a session.
    pub fn write(&self, id: &str, data: &[u8]) -> Result<()> {
        let sessions = self.sessions.read();
        let session = sessions
            .get(id)
            .ok_or_else(|| Error::SessionNotFound(id.to_string()))?;
        session.write(data)
    }

    /// Resize a session.
    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<()> {
        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| Error::SessionNotFound(id.to_string()))?;
        session.resize(cols, rows)
    }

    /// Get screen state.
    pub fn get_screen(&self, id: &str) -> Result<Screen> {
        let sessions = self.sessions.read();
        let session = sessions
            .get(id)
            .ok_or_else(|| Error::SessionNotFound(id.to_string()))?;
        Ok(session.get_screen())
    }

    /// Process output for all sessions.
    pub fn process_all(&self) {
        let mut sessions = self.sessions.write();
        for session in sessions.values_mut() {
            session.process_output();
        }
    }

    /// Process output for a specific session.
    pub fn process(&self, id: &str) -> Result<Option<ScreenUpdate>> {
        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| Error::SessionNotFound(id.to_string()))?;
        Ok(session.process_output())
    }

    /// Get theme for a session.
    pub fn get_theme(&self, id: &str) -> Result<Theme> {
        let sessions = self.sessions.read();
        let session = sessions
            .get(id)
            .ok_or_else(|| Error::SessionNotFound(id.to_string()))?;
        Ok(session.theme().clone())
    }

    /// Set theme for a session.
    pub fn set_theme(&self, id: &str, theme_name: &str) -> Result<()> {
        let theme = Theme::by_name(theme_name)
            .ok_or_else(|| Error::InvalidConfig(format!("Unknown theme: {}", theme_name)))?;

        let mut sessions = self.sessions.write();
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| Error::SessionNotFound(id.to_string()))?;
        session.set_theme(theme);
        Ok(())
    }

    /// Get the number of active sessions.
    pub fn count(&self) -> usize {
        self.sessions.read().len()
    }

    /// Clean up dead sessions.
    pub fn cleanup_dead(&self) -> Vec<SessionId> {
        let mut sessions = self.sessions.write();
        let dead: Vec<SessionId> = sessions
            .iter()
            .filter(|(_, s)| !s.is_alive())
            .map(|(id, _)| id.clone())
            .collect();

        for id in &dead {
            if sessions.remove(id).is_some() {
                let _ = self.event_sender.send(TerminalEvent::ProcessExit {
                    session_id: id.clone(),
                    exit_code: None,
                });
            }
        }

        dead
    }
}
