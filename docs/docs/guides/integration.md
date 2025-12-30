---
sidebar_position: 3
---

# Integration Guide

Integrate tauri-plugin-terminal with your Tauri application.

## Tauri Capabilities

### Basic Setup

Add terminal permissions to your capabilities:

```json
// src-tauri/capabilities/default.json
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

### Permission Breakdown

The `terminal:default` permission includes:

- `terminal:allow-create-session` - Create new sessions
- `terminal:allow-destroy-session` - Destroy sessions
- `terminal:allow-list-sessions` - List all sessions
- `terminal:allow-get-session` - Get session info
- `terminal:allow-write-to-session` - Write to PTY
- `terminal:allow-resize-session` - Resize terminal
- `terminal:allow-get-screen` - Read screen buffer
- `terminal:allow-get-theme` - Get theme
- `terminal:allow-set-theme` - Set theme

## Shell Integration

### Detecting Shell

The plugin auto-detects the user's shell from `$SHELL`:

```typescript
// Uses $SHELL by default
const session1 = await createSession({ cwd: "~" });

// Or specify explicitly
const session2 = await createSession({
  cwd: "~",
  shell: "/bin/zsh",
});
```

### oh-my-zsh Compatibility

The plugin sets `ITERM_SHELL_INTEGRATION_INSTALLED=Yes` for zsh shells, enabling:

- Prompt markers
- Command tracking
- Directory detection

### Environment Variables

Pass environment variables to the session:

```typescript
const session = await createSession({
  cwd: "/project",
  env: {
    NODE_ENV: "development",
    PATH: `/custom/bin:${process.env.PATH}`,
    MY_VAR: "value",
  },
});
```

## Event Integration

### Tauri Events

All terminal events are emitted as Tauri events:

```typescript
import { listen } from "@tauri-apps/api/event";
import { TERMINAL_EVENTS } from "@anthropic/tauri-plugin-terminal";

// Screen updates
listen(TERMINAL_EVENTS.SCREEN_UPDATE, (event) => {
  // event.payload: ScreenUpdate
});

// Bell
listen(TERMINAL_EVENTS.BELL, (event) => {
  // Play sound, show notification
  new Audio("/bell.wav").play();
});

// Title changes
listen(TERMINAL_EVENTS.TITLE_CHANGE, (event) => {
  document.title = event.payload.title;
});

// Directory changes
listen(TERMINAL_EVENTS.DIRECTORY_CHANGE, (event) => {
  // Update file explorer, breadcrumbs, etc.
  console.log("Now in:", event.payload.cwd);
});

// Process exit
listen(TERMINAL_EVENTS.PROCESS_EXIT, (event) => {
  console.log("Exit code:", event.payload.exit_code);
});

// Hyperlinks
listen(TERMINAL_EVENTS.HYPERLINK, (event) => {
  // Handle Cmd+click on links
  const { url, row, start_col, end_col } = event.payload;
});
```

## Window Management

### Floating Terminal

Create a floating terminal window:

```rust
// src-tauri/src/lib.rs
use tauri::Manager;

#[tauri::command]
fn open_terminal_window(app: tauri::AppHandle) {
    tauri::WebviewWindowBuilder::new(
        &app,
        "terminal",
        tauri::WebviewUrl::App("terminal.html".into())
    )
    .title("Terminal")
    .inner_size(800.0, 600.0)
    .build()
    .unwrap();
}
```

### Global Hotkey

Show/hide terminal with a global hotkey:

```rust
use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_terminal::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut("CommandOrControl+`")?
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap() {
                                window.hide().unwrap();
                            } else {
                                window.show().unwrap();
                                window.set_focus().unwrap();
                            }
                        }
                    }
                })
                .build()
        )
        .run(tauri::generate_context!())
        .unwrap();
}
```

## Styling Integration

### CSS Variables

Style the terminal container:

```css
.terminal-container {
  width: 100%;
  height: 100%;
  background: var(--terminal-bg, #18181b);
  border-radius: 8px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
}

.terminal-title {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
```

### Tailwind CSS

```tsx
<div className="w-full h-full bg-zinc-900 rounded-lg overflow-hidden">
  <div className="flex items-center px-3 py-2 bg-black/20">
    <div className="flex gap-1.5">
      <div className="w-3 h-3 rounded-full bg-red-500" />
      <div className="w-3 h-3 rounded-full bg-yellow-500" />
      <div className="w-3 h-3 rounded-full bg-green-500" />
    </div>
    <span className="flex-1 text-center text-xs text-white/70">
      {title}
    </span>
  </div>
  <Terminal sessionId={sessionId} className="flex-1" />
</div>
```

## Testing

### Unit Tests

Mock the terminal API in tests:

```typescript
// __mocks__/@anthropic/tauri-plugin-terminal.ts
export const createSession = jest.fn().mockResolvedValue("test-session");
export const destroySession = jest.fn().mockResolvedValue(undefined);
export const writeToSession = jest.fn().mockResolvedValue(undefined);
export const getScreen = jest.fn().mockResolvedValue({
  cells: [],
  cursor: { position: { row: 0, col: 0 }, visible: true },
  size: { cols: 80, rows: 24 },
});
```

### Integration Tests

```rust
#[cfg(test)]
mod tests {
    use tauri_plugin_terminal::*;

    #[test]
    fn test_session_creation() {
        let (sender, _) = events::event_channel();
        let manager = SessionManager::new(sender);

        let id = manager.create(SessionConfig::default()).unwrap();
        assert!(manager.get_info(&id).is_ok());

        manager.destroy(&id).unwrap();
        assert!(manager.get_info(&id).is_err());
    }
}
```
