//! PTY (pseudo-terminal) management.

use crate::error::{Error, Result};
use crate::types::Size;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::mpsc;
use parking_lot::Mutex;

/// Configuration for spawning a PTY.
#[derive(Debug, Clone)]
pub struct PtyConfig {
    /// Working directory.
    pub cwd: Option<String>,
    /// Shell to use (defaults to system shell).
    pub shell: Option<String>,
    /// Environment variables.
    pub env: Vec<(String, String)>,
    /// Initial size.
    pub size: Size,
}

impl Default for PtyConfig {
    fn default() -> Self {
        Self {
            cwd: None,
            shell: None,
            env: Vec::new(),
            size: Size::default(),
        }
    }
}

/// A running PTY process.
pub struct Pty {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    /// Channel for reading PTY output.
    output_rx: mpsc::UnboundedReceiver<Vec<u8>>,
    /// Handle to the reader thread.
    _reader_handle: std::thread::JoinHandle<()>,
    /// Whether the PTY is still alive.
    alive: Arc<std::sync::atomic::AtomicBool>,
}

impl Pty {
    /// Spawn a new PTY with the given configuration.
    pub fn spawn(config: PtyConfig) -> Result<Self> {
        let pty_system = native_pty_system();

        // Create PTY pair
        let pair = pty_system.openpty(PtySize {
            rows: config.size.rows,
            cols: config.size.cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| Error::PtyError(e.to_string()))?;

        // Build command
        let shell = config.shell.unwrap_or_else(|| {
            std::env::var("SHELL").unwrap_or_else(|_| {
                if cfg!(windows) {
                    "powershell.exe".to_string()
                } else {
                    "/bin/sh".to_string()
                }
            })
        });

        let mut cmd = CommandBuilder::new(&shell);

        // Set working directory
        if let Some(ref cwd) = config.cwd {
            cmd.cwd(cwd);
        }

        // Set environment
        for (key, value) in &config.env {
            cmd.env(key, value);
        }

        // Set TERM
        cmd.env("TERM", "xterm-256color");

        // Enable shell integration for common shells
        if shell.contains("zsh") {
            // oh-my-zsh compatible prompt markers
            cmd.env("ITERM_SHELL_INTEGRATION_INSTALLED", "Yes");
        }

        // Spawn the child process
        let _child = pair.slave.spawn_command(cmd)
            .map_err(|e| Error::PtyError(e.to_string()))?;

        // Set up output reading
        let mut reader = pair.master.try_clone_reader()
            .map_err(|e| Error::PtyError(e.to_string()))?;
        let (output_tx, output_rx) = mpsc::unbounded_channel();
        let alive = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let alive_clone = alive.clone();

        let reader_handle = std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF - process exited
                        alive_clone.store(false, std::sync::atomic::Ordering::SeqCst);
                        break;
                    }
                    Ok(n) => {
                        if output_tx.send(buf[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("PTY read error: {}", e);
                        alive_clone.store(false, std::sync::atomic::Ordering::SeqCst);
                        break;
                    }
                }
            }
        });

        // Get writer before moving master
        let writer = pair.master.take_writer()
            .map_err(|e| Error::PtyError(e.to_string()))?;

        Ok(Self {
            writer: Arc::new(Mutex::new(writer)),
            master: Arc::new(Mutex::new(pair.master)),
            output_rx,
            _reader_handle: reader_handle,
            alive,
        })
    }

    /// Write data to the PTY.
    pub fn write(&self, data: &[u8]) -> Result<()> {
        let mut writer = self.writer.lock();
        writer.write_all(data).map_err(|e| Error::PtyError(e.to_string()))?;
        Ok(())
    }

    /// Resize the PTY.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        let master = self.master.lock();
        master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| Error::PtyError(e.to_string()))?;
        Ok(())
    }

    /// Check if PTY has output available.
    pub async fn read(&mut self) -> Option<Vec<u8>> {
        self.output_rx.recv().await
    }

    /// Try to read without blocking.
    pub fn try_read(&mut self) -> Option<Vec<u8>> {
        self.output_rx.try_recv().ok()
    }

    /// Check if the PTY process is still alive.
    pub fn is_alive(&self) -> bool {
        self.alive.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Kill the PTY process.
    pub fn kill(&self) {
        self.alive.store(false, std::sync::atomic::Ordering::SeqCst);
        // The reader thread will exit when it detects the process is gone
    }
}
