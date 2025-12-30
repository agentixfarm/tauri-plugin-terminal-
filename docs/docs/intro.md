---
sidebar_position: 1
---

# Introduction

**tauri-plugin-terminal** is a high-performance, Rust-native terminal plugin for Tauri v2 applications. Unlike traditional terminal solutions that rely on DOM-based rendering (like xterm.js), this plugin keeps terminal state in Rust, providing:

- **Persistent State** - Terminal content survives React component unmount/remount
- **High Performance** - GPU-accelerated canvas rendering at 60fps
- **Multi-Session** - Run multiple independent terminal sessions
- **iTerm2/oh-my-zsh Compatible** - Shell integration, marks, images

## Why Another Terminal Plugin?

Existing terminal solutions for web/desktop have limitations:

### The DOM Problem

Traditional terminals like xterm.js store state in the DOM. This causes issues with:

- **React Lifecycle** - Unmounting a component loses terminal history
- **Tab Switching** - Content disappears when switching tabs
- **Performance** - DOM manipulation is slow for high-frequency updates

### Our Solution: Rust-Native State

By keeping terminal state in Rust:

```
┌─────────────────────────────────────────────────┐
│  React Component    React Component             │
│  <Terminal A />     <Terminal A />              │
│       │                   │                     │
│       └───────────┬───────┘                     │
│                   │                             │
│           ┌───────▼───────┐                     │
│           │  Rust State   │                     │
│           │  Session A    │  ← Persists here!   │
│           │  scrollback   │                     │
│           │  cursor pos   │                     │
│           │  colors       │                     │
│           └───────────────┘                     │
└─────────────────────────────────────────────────┘
```

Multiple React components can render the same session, and unmounting doesn't lose state.

## Features

### Core
- 🦀 **Rust-native** - vt100 terminal emulation in Rust
- 📦 **Session persistence** - Content survives component lifecycle
- 🎨 **Canvas rendering** - GPU-accelerated, smooth scrolling
- 🎭 **Themes** - Dark, Light, Solarized, Dracula, Nord, One Dark

### iTerm2 Inspired
- 🔀 **Split panes** - Horizontal/vertical splits (coming soon)
- 🖼️ **Image protocol** - Display images inline (coming soon)
- 📍 **Marks** - Navigate between command outputs
- 🔗 **Hyperlinks** - Clickable URLs

### oh-my-zsh Compatible
- 📊 **Shell integration** - Prompt/command markers
- 📂 **Directory tracking** - Auto-detect cwd changes
- ✅ **Exit codes** - Visual command success/failure

## Architecture

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

## Performance

| Metric | Target |
|--------|--------|
| First paint | < 50ms |
| Input latency | < 16ms |
| Scroll FPS | 60fps |
| Memory per session | < 10MB |
| Scrollback | 10,000 lines |

## Next Steps

- [Getting Started](./getting-started) - Install and set up the plugin
- [API Reference](./api/rust) - Full API documentation
- [Examples](./examples/basic) - Code examples
