# tauri-plugin-terminal - Design Document

> The World's Best Terminal UX for Tauri Applications

## Vision

Create a production-ready, high-performance terminal plugin for Tauri that:
- **Just Works** - Zero configuration needed for basic use
- **Persists State** - Terminal content survives component unmount/remount
- **Multi-Session** - Run multiple independent terminal sessions
- **Beautiful** - Modern, customizable themes with smooth rendering
- **Accessible** - Full keyboard navigation, screen reader support
- **Fast** - Rust-native state management, efficient rendering

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri Application                         │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React/TypeScript)                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  <Terminal />   │  │  <Terminal />   │  │  <Terminal />   │  │
│  │  session="a"    │  │  session="b"    │  │  session="c"    │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│           └────────────────────┼────────────────────┘            │
│                                │                                 │
│  ┌─────────────────────────────▼─────────────────────────────┐  │
│  │              Terminal Manager (TypeScript)                 │  │
│  │  - Event subscriptions                                     │  │
│  │  - Input handling                                          │  │
│  │  - Render scheduling                                       │  │
│  └─────────────────────────────┬─────────────────────────────┘  │
├────────────────────────────────┼────────────────────────────────┤
│                     Tauri IPC Bridge                             │
├────────────────────────────────┼────────────────────────────────┤
│  Backend (Rust)                │                                 │
│  ┌─────────────────────────────▼─────────────────────────────┐  │
│  │              Terminal Plugin (Rust)                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │ Session A   │  │ Session B   │  │ Session C   │        │  │
│  │  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │        │  │
│  │  │ │  vt100  │ │  │ │  vt100  │ │  │ │  vt100  │ │        │  │
│  │  │ │ Parser  │ │  │ │ Parser  │ │  │ │ Parser  │ │        │  │
│  │  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │        │  │
│  │  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │        │  │
│  │  │ │   PTY   │ │  │ │   PTY   │ │  │ │   PTY   │ │        │  │
│  │  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │        │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. State Lives in Rust

**Problem**: xterm.js keeps state in DOM, causing issues with React lifecycle.

**Solution**: Terminal state (scrollback, cursor, colors) lives in Rust via `vt100` crate.
- Frontend only renders what Rust tells it to
- Unmounting a React component doesn't lose terminal state
- Multiple components can render the same session

### 2. Event-Driven Rendering

**Problem**: Polling for terminal updates is inefficient.

**Solution**: Rust emits events when terminal state changes.
```rust
// Rust emits structured events
TerminalEvent::ScreenUpdate { session_id, cells, cursor }
TerminalEvent::Bell { session_id }
TerminalEvent::TitleChange { session_id, title }
```

### 3. Incremental Updates

**Problem**: Sending entire terminal buffer on every change is slow.

**Solution**: Send only changed cells (dirty rectangles).
```typescript
interface ScreenUpdate {
  sessionId: string;
  changes: CellChange[];  // Only changed cells
  cursor: CursorPosition;
}
```

### 4. Canvas Rendering

**Problem**: DOM-based rendering (one element per cell) is slow for large terminals.

**Solution**: Render to HTML5 Canvas for performance.
- Single canvas element per terminal
- GPU-accelerated text rendering
- Ligature support via font shaping
- Selection rendering as overlay

### 5. Session Persistence

**Problem**: Users expect terminal history when switching tabs.

**Solution**: Sessions persist in Rust, frontend just reconnects.
```typescript
// Same session, different component instances
<Terminal sessionId="main" />  // In Tab 1
<Terminal sessionId="main" />  // In Tab 2 - same content!
```

## API Design

### Rust API

```rust
// Plugin initialization
pub fn init<R: Runtime>() -> TauriPlugin<R>

// Session management
pub fn create_session(config: SessionConfig) -> SessionId
pub fn destroy_session(id: SessionId)
pub fn list_sessions() -> Vec<SessionInfo>

// Terminal interaction
pub fn write(session: SessionId, data: &[u8])
pub fn resize(session: SessionId, cols: u16, rows: u16)
pub fn get_screen(session: SessionId) -> Screen
pub fn get_scrollback(session: SessionId, lines: u32) -> Vec<Line>

// Configuration
pub fn set_theme(theme: Theme)
pub fn set_font(font: FontConfig)
```

### TypeScript API

```typescript
// Hook-based API
const {
  screen,      // Current screen content
  write,       // Write to terminal
  resize,      // Resize terminal
  isReady,     // PTY is connected
} = useTerminal('session-id');

// Component API
<Terminal
  sessionId="my-session"
  cwd="/path/to/dir"
  shell="/bin/zsh"
  theme="dark"
  fontSize={14}
  fontFamily="JetBrains Mono"
  onData={(data) => {}}
  onResize={(cols, rows) => {}}
  onTitleChange={(title) => {}}
/>
```

## Data Structures

### Cell

```rust
pub struct Cell {
    pub char: char,
    pub fg: Color,
    pub bg: Color,
    pub attrs: CellAttributes,  // bold, italic, underline, etc.
}
```

### Screen

```rust
pub struct Screen {
    pub cells: Vec<Vec<Cell>>,  // [row][col]
    pub cursor: Cursor,
    pub size: Size,
    pub scrollback_len: u32,
}
```

### Theme

```rust
pub struct Theme {
    pub name: String,
    pub foreground: Color,
    pub background: Color,
    pub cursor: Color,
    pub selection: Color,
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

## iTerm2 & oh-my-zsh Inspired Features

We aim to bring the best features from iTerm2 and oh-my-zsh to Tauri applications:

### Shell Integration (oh-my-zsh compatible)
- **Prompt Detection**: Detect when shell is ready for input
- **Command Tracking**: Track command start/end for better UX
- **Current Directory**: Auto-detect cwd changes
- **Git Integration**: Show git status in terminal chrome (optional)
- **Exit Code Display**: Visual indicator for command success/failure

### iTerm2 Features
- **Split Panes**: Horizontal/vertical splits within a session
- **Image Protocol**: Display images inline (iTerm2 escape sequences)
- **Marks**: Navigate between command outputs
- **Triggers**: Auto-actions based on output patterns
- **Semantic History**: Cmd+click to open files/URLs
- **Profile System**: Save and switch terminal configurations
- **Hotkey Window**: Global hotkey to show/hide terminal
- **Shell Integration Markers**: Visual markers for each command

### Keyboard Shortcuts (Configurable)
| Action | Default (macOS) | Default (Other) |
|--------|-----------------|-----------------|
| Split Horizontal | ⌘D | Ctrl+Shift+D |
| Split Vertical | ⌘⇧D | Ctrl+Shift+E |
| Navigate Panes | ⌘⌥Arrow | Ctrl+Alt+Arrow |
| Search | ⌘F | Ctrl+Shift+F |
| Clear | ⌘K | Ctrl+L |
| Previous Mark | ⌘↑ | Ctrl+Shift+Up |
| Next Mark | ⌘↓ | Ctrl+Shift+Down |

## Features Roadmap

### v0.1.0 - MVP
- [ ] Basic PTY management
- [ ] vt100 terminal emulation
- [ ] React component with canvas rendering
- [ ] Basic themes (dark/light)
- [ ] Keyboard input handling
- [ ] Mouse selection (copy)
- [ ] Session persistence
- [ ] Auto-detect shell (zsh, bash, fish, etc.)

### v0.2.0 - Shell Integration
- [ ] Shell integration markers (oh-my-zsh compatible)
- [ ] Command tracking (start/end/exit code)
- [ ] Current directory detection
- [ ] Semantic history (Cmd+click files/URLs)
- [ ] Ligature support
- [ ] Custom fonts
- [ ] Hyperlink detection
- [ ] Search in scrollback
- [ ] Bracketed paste mode
- [ ] OSC 52 clipboard

### v0.3.0 - Split Panes & Images
- [ ] Split panes (horizontal/vertical)
- [ ] Pane navigation shortcuts
- [ ] Image protocol (iTerm2/Kitty)
- [ ] Marks navigation
- [ ] Profile system
- [ ] Session recording/playback
- [ ] WebGL rendering option
- [ ] Accessibility (screen reader)

### v0.4.0 - Advanced
- [ ] Triggers (pattern-based actions)
- [ ] Global hotkey window
- [ ] Git integration in chrome
- [ ] Autocomplete hints
- [ ] AI-powered command suggestions
- [ ] Session sync across devices

## Performance Targets

| Metric | Target |
|--------|--------|
| First paint | < 50ms |
| Input latency | < 16ms |
| Scroll FPS | 60fps |
| Memory per session | < 10MB |
| Scrollback (default) | 10,000 lines |

## File Structure

```
tauri-plugin-terminal/
├── Cargo.toml                 # Rust workspace
├── package.json               # NPM package
├── tsconfig.json
├── README.md
├── LICENSE
├── DESIGN.md                  # This document
│
├── rust/                      # Rust crate
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs             # Plugin entry
│       ├── plugin.rs          # Tauri plugin impl
│       ├── session.rs         # Session management
│       ├── terminal.rs        # vt100 wrapper
│       ├── pty.rs             # PTY handling
│       ├── commands.rs        # Tauri commands
│       ├── events.rs          # Event types
│       └── theme.rs           # Theme definitions
│
├── guest-js/                  # TypeScript bindings
│   ├── index.ts               # Main exports
│   ├── api.ts                 # Tauri command wrappers
│   ├── types.ts               # TypeScript types
│   └── hooks.ts               # React hooks
│
├── react/                     # React component
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── Terminal.tsx       # Main component
│   │   ├── Canvas.tsx         # Canvas renderer
│   │   ├── Selection.tsx      # Selection overlay
│   │   └── themes/
│   │       ├── index.ts
│   │       ├── dark.ts
│   │       └── light.ts
│   └── tsconfig.json
│
├── docs/                      # Docusaurus site
│   ├── docusaurus.config.js
│   ├── docs/
│   │   ├── intro.md
│   │   ├── getting-started.md
│   │   ├── api/
│   │   │   ├── rust.md
│   │   │   └── typescript.md
│   │   ├── guides/
│   │   │   ├── theming.md
│   │   │   ├── multi-session.md
│   │   │   └── integration.md
│   │   └── examples/
│   │       ├── basic.md
│   │       └── advanced.md
│   └── static/
│
└── examples/                  # Example Tauri apps
    └── basic/
        ├── src-tauri/
        └── src/
```

## Security Considerations

1. **PTY Access**: Only allow PTY operations through Tauri commands (no direct shell access)
2. **Path Validation**: Validate `cwd` paths to prevent directory traversal
3. **Input Sanitization**: Sanitize data written to PTY
4. **Permissions**: Respect Tauri's capability system

## Testing Strategy

1. **Unit Tests**: Rust terminal parsing, TypeScript utilities
2. **Integration Tests**: PTY spawning, event flow
3. **Visual Tests**: Screenshot comparison for rendering
4. **Performance Tests**: Benchmarks for rendering, scrolling

## References

- [vt100 crate](https://docs.rs/vt100)
- [portable-pty](https://docs.rs/portable-pty)
- [Tauri Plugin Development](https://tauri.app/develop/plugins/)
- [Alacritty](https://github.com/alacritty/alacritty) - For inspiration
- [xterm.js](https://xtermjs.org/) - Feature reference
