# tauri-plugin-terminal

> The World's Best Terminal UX for Tauri Applications

A high-performance, Rust-native terminal plugin for Tauri v2 applications with persistent state, canvas rendering, and iTerm2/oh-my-zsh inspired features.

## Features

- **Rust-Native State** - Terminal state lives in Rust, not DOM. No more losing scrollback when switching tabs.
- **Session Persistence** - Terminal content survives component unmount/remount. Multiple components can render the same session.
- **Canvas Rendering** - GPU-accelerated, 60fps smooth scrolling with ligature support.
- **Multi-Session** - Run multiple independent terminal sessions.
- **iTerm2 Compatible** - Split panes, image protocol, marks, hyperlinks.
- **oh-my-zsh Compatible** - Shell integration markers, command tracking, exit codes.
- **Beautiful Themes** - Dark, Light, Solarized, Dracula, Nord, One Dark.

## Installation

### Rust

Add to your `Cargo.toml`:

```toml
[dependencies]
tauri-plugin-terminal = "0.1"
```

### JavaScript/TypeScript

```bash
npm install @anthropic/tauri-plugin-terminal
# or
pnpm add @anthropic/tauri-plugin-terminal
```

## Quick Start

### Rust Setup

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_terminal::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### React Usage

```tsx
import { Terminal, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";

function App() {
  const { sessionId, create, isReady } = useTerminalSession({
    cwd: "/home/user",
    shell: "/bin/zsh",
  });

  useEffect(() => {
    create();
  }, []);

  if (!sessionId) return <div>Loading...</div>;

  return (
    <Terminal
      sessionId={sessionId}
      fontSize={14}
      fontFamily="JetBrains Mono"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
```

### TypeScript API

```typescript
import terminal from "@anthropic/tauri-plugin-terminal";

// Create a session
const sessionId = await terminal.createSession({
  cwd: "/home/user",
  shell: "/bin/zsh",
});

// Write to terminal
await terminal.writeToSession(sessionId, "ls -la\n");

// Get screen state
const screen = await terminal.getScreen(sessionId);

// Resize
await terminal.resizeSession(sessionId, 120, 40);

// Destroy session
await terminal.destroySession(sessionId);
```

## Configuration

### Tauri Capabilities

Add to your `capabilities/default.json`:

```json
{
  "permissions": [
    "terminal:default"
  ]
}
```

### Session Options

```typescript
interface SessionConfig {
  id?: string;           // Optional session ID
  cwd?: string;          // Working directory
  shell?: string;        // Shell to use (default: $SHELL)
  env?: Record<string, string>;  // Environment variables
  cols?: number;         // Initial columns (default: 80)
  rows?: number;         // Initial rows (default: 24)
  theme?: string;        // Theme name
}
```

### Terminal Component Props

```typescript
interface TerminalProps {
  sessionId: string;
  fontSize?: number;      // Default: 14
  fontFamily?: string;    // Default: JetBrains Mono
  lineHeight?: number;    // Default: 1.2
  focused?: boolean;      // Default: true
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onTitleChange?: (title: string) => void;
  className?: string;
  style?: React.CSSProperties;
}
```

## Themes

Available themes:

- `dark` (default)
- `light`
- `solarized-dark`
- `dracula`
- `nord`
- `one-dark`

```typescript
await terminal.setTheme(sessionId, "dracula");
```

## Events

Listen to terminal events:

```typescript
import { listen } from "@tauri-apps/api/event";
import { TERMINAL_EVENTS } from "@anthropic/tauri-plugin-terminal";

// Screen updates
await listen(TERMINAL_EVENTS.SCREEN_UPDATE, (event) => {
  console.log("Screen updated:", event.payload);
});

// Bell
await listen(TERMINAL_EVENTS.BELL, (event) => {
  console.log("Bell rang!");
});

// Process exit
await listen(TERMINAL_EVENTS.PROCESS_EXIT, (event) => {
  console.log("Process exited:", event.payload.exit_code);
});
```

## Performance

| Metric | Target |
|--------|--------|
| First paint | < 50ms |
| Input latency | < 16ms |
| Scroll FPS | 60fps |
| Memory per session | < 10MB |
| Scrollback | 10,000 lines |

## Roadmap

### v0.1.0 - MVP ✅
- Basic PTY management
- vt100 terminal emulation
- React component with canvas rendering
- Themes
- Keyboard input
- Mouse selection
- Session persistence

### v0.2.0 - Shell Integration
- Shell integration markers (oh-my-zsh compatible)
- Command tracking
- Current directory detection
- Semantic history (Cmd+click files/URLs)
- Ligature support
- Search in scrollback

### v0.3.0 - Split Panes & Images
- Split panes (horizontal/vertical)
- Image protocol (iTerm2/Kitty)
- Marks navigation
- Profile system

### v0.4.0 - Advanced
- Triggers (pattern-based actions)
- Global hotkey window
- Git integration
- AI-powered command suggestions

## License

MIT OR Apache-2.0

## Credits

Built with:
- [vt100](https://docs.rs/vt100) - Terminal emulation
- [portable-pty](https://docs.rs/portable-pty) - PTY management
- [Tauri](https://tauri.app) - Desktop framework

Inspired by:
- [iTerm2](https://iterm2.com)
- [Alacritty](https://alacritty.org)
- [oh-my-zsh](https://ohmyz.sh)
