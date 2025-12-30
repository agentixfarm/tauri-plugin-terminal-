---
sidebar_position: 2
---

# Getting Started

This guide will help you set up tauri-plugin-terminal in your Tauri v2 application.

## Prerequisites

- [Tauri v2](https://tauri.app/start/create-project/)
- Rust 1.70+
- Node.js 18+

## Installation

### 1. Add the Rust Plugin

Add the plugin to your `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri-plugin-terminal = "0.1"
```

### 2. Register the Plugin

In your `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_terminal::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. Add Capabilities

Create or update `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "terminal:default"
  ]
}
```

### 4. Install the JavaScript Package

```bash
npm install @anthropic/tauri-plugin-terminal
# or
pnpm add @anthropic/tauri-plugin-terminal
# or
yarn add @anthropic/tauri-plugin-terminal
```

## Basic Usage

### React Component

```tsx
import { useEffect, useRef } from "react";
import { Terminal, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";

function App() {
  const terminalRef = useRef(null);
  const { sessionId, create, isReady, isCreating } = useTerminalSession({
    cwd: "/home/user",
    shell: "/bin/zsh",
  });

  // Create session on mount
  useEffect(() => {
    create();
  }, []);

  if (isCreating) {
    return <div>Creating terminal session...</div>;
  }

  if (!sessionId) {
    return <div>No session</div>;
  }

  return (
    <Terminal
      ref={terminalRef}
      sessionId={sessionId}
      fontSize={14}
      fontFamily="JetBrains Mono"
      style={{ width: "100%", height: "100vh" }}
      onTitleChange={(title) => {
        document.title = title;
      }}
    />
  );
}

export default App;
```

### TypeScript API

```typescript
import terminal from "@anthropic/tauri-plugin-terminal";

async function main() {
  // Create a session
  const sessionId = await terminal.createSession({
    cwd: "/home/user",
    shell: "/bin/zsh",
    cols: 120,
    rows: 40,
    theme: "dracula",
  });

  console.log("Session created:", sessionId);

  // Write a command
  await terminal.writeToSession(sessionId, "ls -la\n");

  // Wait a bit for output
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Get the screen state
  const screen = await terminal.getScreen(sessionId);
  console.log("Screen size:", screen.size);
  console.log("Cursor at:", screen.cursor.position);

  // Clean up
  await terminal.destroySession(sessionId);
}

main();
```

## Listening to Events

```typescript
import { listen } from "@tauri-apps/api/event";
import { TERMINAL_EVENTS } from "@anthropic/tauri-plugin-terminal";

// Screen updates (incremental)
await listen(TERMINAL_EVENTS.SCREEN_UPDATE, (event) => {
  console.log("Screen updated:", event.payload.changes.length, "cells changed");
});

// Terminal bell
await listen(TERMINAL_EVENTS.BELL, (event) => {
  console.log("Bell!");
  // Play a sound or show a notification
});

// Title changes
await listen(TERMINAL_EVENTS.TITLE_CHANGE, (event) => {
  document.title = event.payload.title;
});

// Process exit
await listen(TERMINAL_EVENTS.PROCESS_EXIT, (event) => {
  console.log("Process exited with code:", event.payload.exit_code);
});
```

## Configuration Options

### Session Config

```typescript
interface SessionConfig {
  // Optional session ID (UUID generated if not provided)
  id?: string;

  // Working directory (defaults to home)
  cwd?: string;

  // Shell to use (defaults to $SHELL or /bin/sh)
  shell?: string;

  // Environment variables to add
  env?: Record<string, string>;

  // Initial terminal size
  cols?: number;  // default: 80
  rows?: number;  // default: 24

  // Theme name
  theme?: string;  // default: "dark"
}
```

### Terminal Component Props

```typescript
interface TerminalProps {
  // Required: session ID to render
  sessionId: string;

  // Font settings
  fontSize?: number;      // default: 14
  fontFamily?: string;    // default: JetBrains Mono
  lineHeight?: number;    // default: 1.2

  // Focus state
  focused?: boolean;      // default: true

  // Callbacks
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onTitleChange?: (title: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;

  // Styling
  className?: string;
  style?: React.CSSProperties;
}
```

## Next Steps

- [Theming Guide](./guides/theming) - Customize terminal appearance
- [Multi-Session Guide](./guides/multi-session) - Manage multiple terminals
- [API Reference](./api/typescript) - Full TypeScript API docs
