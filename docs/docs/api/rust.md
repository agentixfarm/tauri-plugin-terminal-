---
sidebar_position: 1
---

# Rust API Reference

Complete reference for the Rust API.

## Plugin Initialization

```rust
use tauri_plugin_terminal;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_terminal::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Types

### SessionConfig

Configuration for creating a new session.

```rust
pub struct SessionConfig {
    /// Optional session ID (generated if not provided).
    pub id: Option<String>,

    /// Working directory.
    pub cwd: Option<String>,

    /// Shell to use.
    pub shell: Option<String>,

    /// Environment variables.
    pub env: HashMap<String, String>,

    /// Initial terminal size.
    pub cols: Option<u16>,
    pub rows: Option<u16>,

    /// Theme name.
    pub theme: Option<String>,
}
```

### SessionInfo

Information about a session.

```rust
pub struct SessionInfo {
    pub id: String,
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub title: String,
    pub size: Size,
    pub is_alive: bool,
    pub created_at: u64,
}
```

### Size

Terminal dimensions.

```rust
pub struct Size {
    pub cols: u16,
    pub rows: u16,
}
```

### Cursor

Cursor state.

```rust
pub struct Cursor {
    pub position: CursorPosition,
    pub visible: bool,
    pub shape: CursorShape,
}

pub struct CursorPosition {
    pub row: u16,
    pub col: u16,
}

pub enum CursorShape {
    Block,
    Underline,
    Bar,
}
```

### Cell

A single terminal cell.

```rust
pub struct Cell {
    pub char: String,
    pub fg: Color,
    pub bg: Color,
    pub attrs: CellAttributes,
}

pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

pub struct CellAttributes {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
    pub inverse: bool,
    pub dim: bool,
    pub blink: bool,
}
```

### Screen

The entire screen buffer.

```rust
pub struct Screen {
    pub cells: Vec<Vec<Cell>>,
    pub cursor: Cursor,
    pub size: Size,
    pub scrollback_len: u32,
    pub title: String,
}
```

### Theme

Terminal color theme.

```rust
pub struct Theme {
    pub name: String,
    pub foreground: Color,
    pub background: Color,
    pub cursor: Color,
    pub cursor_text: Color,
    pub selection: Color,
    pub selection_text: Color,
    pub black: Color,
    pub red: Color,
    pub green: Color,
    pub yellow: Color,
    pub blue: Color,
    pub magenta: Color,
    pub cyan: Color,
    pub white: Color,
    pub bright_black: Color,
    pub bright_red: Color,
    pub bright_green: Color,
    pub bright_yellow: Color,
    pub bright_blue: Color,
    pub bright_magenta: Color,
    pub bright_cyan: Color,
    pub bright_white: Color,
}
```

## Events

Events emitted by the plugin.

```rust
pub enum TerminalEvent {
    SessionCreated { session_id: String },
    SessionDestroyed { session_id: String },
    ScreenUpdate(ScreenUpdate),
    ScreenRefresh { session_id: String, screen: String },
    Bell { session_id: String },
    TitleChange { session_id: String, title: String },
    DirectoryChange { session_id: String, cwd: String },
    Mark { session_id: String, mark: Mark },
    ProcessExit { session_id: String, exit_code: Option<i32> },
    CursorMove { session_id: String, cursor: Cursor },
    SelectionChange { session_id: String, text: Option<String> },
    ClipboardRequest { session_id: String, content: String },
    Hyperlink { session_id: String, url: String, row: u16, start_col: u16, end_col: u16 },
}
```

## Built-in Themes

Available themes:

- `dark` (default)
- `light`
- `solarized-dark`
- `dracula`
- `nord`
- `one-dark`

Get a theme by name:

```rust
use tauri_plugin_terminal::Theme;

let theme = Theme::by_name("dracula");
```

## Error Handling

```rust
pub enum Error {
    SessionNotFound(String),
    SessionAlreadyExists(String),
    PtyError(String),
    TerminalError(String),
    InvalidConfig(String),
    IoError(String),
    SessionClosed,
    LockPoisoned,
}
```

## Advanced Usage

### Accessing Session Manager

You can access the session manager from within your Tauri commands:

```rust
use tauri::State;
use tauri_plugin_terminal::TerminalState;

#[tauri::command]
async fn my_command(state: State<'_, TerminalState>) -> Result<(), String> {
    let sessions = state.manager.list();
    println!("Active sessions: {}", sessions.len());
    Ok(())
}
```

### Custom PTY Configuration

When spawning a session, the plugin automatically:

1. Uses `$SHELL` or falls back to `/bin/sh`
2. Sets `TERM=xterm-256color`
3. Enables shell integration markers for zsh
