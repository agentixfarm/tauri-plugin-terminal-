---
sidebar_position: 2
---

# TypeScript API Reference

Complete reference for the TypeScript/JavaScript API.

## Installation

```bash
npm install @anthropic/tauri-plugin-terminal
```

## API Functions

### createSession

Create a new terminal session.

```typescript
import { createSession } from "@anthropic/tauri-plugin-terminal";

const sessionId = await createSession({
  cwd: "/home/user",
  shell: "/bin/zsh",
  cols: 120,
  rows: 40,
  theme: "dark",
});
```

### destroySession

Destroy a terminal session.

```typescript
import { destroySession } from "@anthropic/tauri-plugin-terminal";

await destroySession(sessionId);
```

### listSessions

List all active sessions.

```typescript
import { listSessions } from "@anthropic/tauri-plugin-terminal";

const sessions = await listSessions();
// SessionInfo[]
```

### getSession

Get information about a specific session.

```typescript
import { getSession } from "@anthropic/tauri-plugin-terminal";

const info = await getSession(sessionId);
console.log(info.title, info.size, info.is_alive);
```

### writeToSession

Write string data to a session.

```typescript
import { writeToSession } from "@anthropic/tauri-plugin-terminal";

await writeToSession(sessionId, "ls -la\n");
```

### writeBytesToSession

Write binary data to a session.

```typescript
import { writeBytesToSession } from "@anthropic/tauri-plugin-terminal";

await writeBytesToSession(sessionId, [0x1b, 0x5b, 0x41]); // Arrow up
```

### resizeSession

Resize a session.

```typescript
import { resizeSession } from "@anthropic/tauri-plugin-terminal";

await resizeSession(sessionId, 120, 40);
```

### getScreen

Get the full screen state.

```typescript
import { getScreen } from "@anthropic/tauri-plugin-terminal";

const screen = await getScreen(sessionId);
console.log(screen.size);      // { cols: 120, rows: 40 }
console.log(screen.cursor);    // { position: { row: 0, col: 0 }, visible: true }
console.log(screen.cells);     // Cell[][]
```

### getTheme / setTheme

Get or set the theme for a session.

```typescript
import { getTheme, setTheme } from "@anthropic/tauri-plugin-terminal";

const theme = await getTheme(sessionId);
await setTheme(sessionId, "dracula");
```

### listThemes

List available themes.

```typescript
import { listThemes } from "@anthropic/tauri-plugin-terminal";

const themes = await listThemes();
// ["dark", "light", "solarized-dark", "dracula", "nord", "one-dark"]
```

## React Hooks

### useTerminal

Hook for managing a terminal session.

```typescript
import { useTerminal } from "@anthropic/tauri-plugin-terminal";

function MyTerminal({ sessionId }) {
  const {
    screen,     // Current screen state
    isReady,    // Whether screen is loaded
    error,      // Any errors
    title,      // Terminal title
    isAlive,    // Whether process is alive
    write,      // Write to terminal
    resize,     // Resize terminal
    refresh,    // Refresh screen
  } = useTerminal(sessionId);

  return <div>{title}</div>;
}
```

### useTerminalSession

Hook for creating and managing a terminal session.

```typescript
import { useTerminalSession } from "@anthropic/tauri-plugin-terminal";

function MyApp() {
  const {
    sessionId,    // Created session ID
    isCreating,   // Whether session is being created
    createError,  // Creation errors
    create,       // Create the session
    destroy,      // Destroy the session
    // ...all useTerminal properties
    screen,
    write,
    resize,
  } = useTerminalSession({
    cwd: "/home/user",
    shell: "/bin/zsh",
  });

  useEffect(() => {
    create();
  }, []);

  return <div>{sessionId}</div>;
}
```

### useTerminalSessions

Hook for listing all sessions.

```typescript
import { useTerminalSessions } from "@anthropic/tauri-plugin-terminal";

function SessionList() {
  const { sessions, isLoading, error, refresh } = useTerminalSessions();

  return (
    <ul>
      {sessions.map((s) => (
        <li key={s.id}>{s.title}</li>
      ))}
    </ul>
  );
}
```

### useTerminalTheme

Hook for theme management.

```typescript
import { useTerminalTheme } from "@anthropic/tauri-plugin-terminal";

function ThemePicker({ sessionId }) {
  const { theme, themes, isLoading, setTheme } = useTerminalTheme(sessionId);

  return (
    <select
      value={theme?.name}
      onChange={(e) => setTheme(e.target.value)}
    >
      {themes.map((name) => (
        <option key={name}>{name}</option>
      ))}
    </select>
  );
}
```

## React Component

### Terminal

Main terminal component with canvas rendering.

```tsx
import { Terminal } from "@anthropic/tauri-plugin-terminal/react";

<Terminal
  sessionId="my-session"
  fontSize={14}
  fontFamily="JetBrains Mono"
  lineHeight={1.2}
  focused={true}
  onData={(data) => console.log("Data:", data)}
  onResize={(cols, rows) => console.log("Resized:", cols, rows)}
  onTitleChange={(title) => console.log("Title:", title)}
  onFocus={() => console.log("Focused")}
  onBlur={() => console.log("Blurred")}
  className="my-terminal"
  style={{ width: "100%", height: "100%" }}
/>
```

### TerminalHandle

Imperative handle for controlling the terminal.

```tsx
import { Terminal, TerminalHandle } from "@anthropic/tauri-plugin-terminal/react";

function MyApp() {
  const terminalRef = useRef<TerminalHandle>(null);

  const handleClick = () => {
    terminalRef.current?.write("echo 'Hello!'\n");
    terminalRef.current?.focus();
  };

  return (
    <>
      <button onClick={handleClick}>Run Command</button>
      <Terminal ref={terminalRef} sessionId="my-session" />
    </>
  );
}
```

## Events

### Event Names

```typescript
import { TERMINAL_EVENTS } from "@anthropic/tauri-plugin-terminal";

TERMINAL_EVENTS.SESSION_CREATED     // "terminal://session-created"
TERMINAL_EVENTS.SESSION_DESTROYED   // "terminal://session-destroyed"
TERMINAL_EVENTS.SCREEN_UPDATE       // "terminal://screen-update"
TERMINAL_EVENTS.SCREEN_REFRESH      // "terminal://screen-refresh"
TERMINAL_EVENTS.BELL                // "terminal://bell"
TERMINAL_EVENTS.TITLE_CHANGE        // "terminal://title-change"
TERMINAL_EVENTS.DIRECTORY_CHANGE    // "terminal://directory-change"
TERMINAL_EVENTS.MARK                // "terminal://mark"
TERMINAL_EVENTS.PROCESS_EXIT        // "terminal://process-exit"
TERMINAL_EVENTS.CURSOR_MOVE         // "terminal://cursor-move"
TERMINAL_EVENTS.SELECTION_CHANGE    // "terminal://selection-change"
TERMINAL_EVENTS.CLIPBOARD_REQUEST   // "terminal://clipboard-request"
TERMINAL_EVENTS.HYPERLINK           // "terminal://hyperlink"
```

### Listening to Events

```typescript
import { listen } from "@tauri-apps/api/event";
import { TERMINAL_EVENTS, type ScreenUpdate } from "@anthropic/tauri-plugin-terminal";

const unlisten = await listen<ScreenUpdate>(
  TERMINAL_EVENTS.SCREEN_UPDATE,
  (event) => {
    console.log("Session:", event.payload.session_id);
    console.log("Changes:", event.payload.changes.length);
    console.log("Cursor:", event.payload.cursor);
  }
);

// Later...
unlisten();
```

## Utility Functions

### colorToCss

Convert Color to CSS rgb string.

```typescript
import { colorToCss } from "@anthropic/tauri-plugin-terminal";

const css = colorToCss({ r: 255, g: 128, b: 0 });
// "rgb(255, 128, 0)"
```

### colorToHex

Convert Color to hex string.

```typescript
import { colorToHex } from "@anthropic/tauri-plugin-terminal";

const hex = colorToHex({ r: 255, g: 128, b: 0 });
// "#ff8000"
```

## Types

See the full type definitions in [types.ts](https://github.com/agentixfarm/tauri-plugin-terminal/blob/main/guest-js/types.ts).
