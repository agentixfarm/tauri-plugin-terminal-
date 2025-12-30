---
sidebar_position: 1
---

# Basic Examples

Simple examples to get started with tauri-plugin-terminal.

## Minimal React App

```tsx
import { useEffect } from "react";
import { Terminal, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";

function App() {
  const { sessionId, create } = useTerminalSession({
    cwd: "~",
  });

  useEffect(() => {
    create();
  }, []);

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <Terminal
      sessionId={sessionId}
      style={{ width: "100%", height: "100vh" }}
    />
  );
}

export default App;
```

## Run a Command

```tsx
import { useEffect, useRef } from "react";
import { Terminal, TerminalHandle, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";

function App() {
  const terminalRef = useRef<TerminalHandle>(null);
  const { sessionId, create, isReady } = useTerminalSession({
    cwd: "/project",
  });

  useEffect(() => {
    create();
  }, []);

  useEffect(() => {
    // Run command when terminal is ready
    if (isReady) {
      terminalRef.current?.write("npm run dev\n");
    }
  }, [isReady]);

  if (!sessionId) return <div>Loading...</div>;

  return (
    <Terminal
      ref={terminalRef}
      sessionId={sessionId}
      style={{ width: "100%", height: "100vh" }}
    />
  );
}
```

## Title in Header

```tsx
import { useState, useEffect } from "react";
import { Terminal, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";

function App() {
  const [title, setTitle] = useState("Terminal");
  const { sessionId, create } = useTerminalSession({ cwd: "~" });

  useEffect(() => { create(); }, []);

  if (!sessionId) return <div>Loading...</div>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{
        padding: "8px 16px",
        background: "#1e1e2e",
        color: "#cdd6f4",
        fontSize: "14px"
      }}>
        {title}
      </header>
      <Terminal
        sessionId={sessionId}
        onTitleChange={setTitle}
        style={{ flex: 1 }}
      />
    </div>
  );
}
```

## Theme Selector

```tsx
import { useState, useEffect } from "react";
import { Terminal, useTerminalSession, useTerminalTheme } from "@anthropic/tauri-plugin-terminal/react";

function App() {
  const { sessionId, create } = useTerminalSession({ cwd: "~" });
  const { themes, setTheme } = useTerminalTheme(sessionId);

  useEffect(() => { create(); }, []);

  if (!sessionId) return <div>Loading...</div>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px", background: "#1e1e2e" }}>
        <select onChange={(e) => setTheme(e.target.value)}>
          {themes.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <Terminal sessionId={sessionId} style={{ flex: 1 }} />
    </div>
  );
}
```

## TypeScript Only (No React)

```typescript
import terminal, { TERMINAL_EVENTS } from "@anthropic/tauri-plugin-terminal";
import { listen } from "@tauri-apps/api/event";

async function main() {
  // Listen for screen updates
  await listen(TERMINAL_EVENTS.SCREEN_UPDATE, (event) => {
    console.log("Screen updated:", event.payload);
  });

  // Create session
  const sessionId = await terminal.createSession({
    cwd: "/home/user",
    cols: 80,
    rows: 24,
  });

  console.log("Session created:", sessionId);

  // Write command
  await terminal.writeToSession(sessionId, "echo 'Hello, World!'\n");

  // Wait for output
  await new Promise((r) => setTimeout(r, 100));

  // Read screen
  const screen = await terminal.getScreen(sessionId);
  console.log("Screen:", screen);

  // Cleanup
  await terminal.destroySession(sessionId);
}

main();
```

## Custom Fonts

```tsx
import { useEffect } from "react";
import { Terminal, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";

function App() {
  const { sessionId, create } = useTerminalSession({ cwd: "~" });

  // Load font on mount
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Fira+Code&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    create();
  }, []);

  if (!sessionId) return <div>Loading...</div>;

  return (
    <Terminal
      sessionId={sessionId}
      fontFamily="'Fira Code', monospace"
      fontSize={15}
      lineHeight={1.3}
      style={{ width: "100%", height: "100vh" }}
    />
  );
}
```

## Bell Notification

```tsx
import { useEffect } from "react";
import { Terminal, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";
import { listen } from "@tauri-apps/api/event";
import { TERMINAL_EVENTS } from "@anthropic/tauri-plugin-terminal";

function App() {
  const { sessionId, create } = useTerminalSession({ cwd: "~" });

  useEffect(() => {
    create();

    // Play sound on bell
    const unlisten = listen(TERMINAL_EVENTS.BELL, () => {
      new Audio("/bell.wav").play().catch(() => {});
    });

    return () => { unlisten.then((fn) => fn()); };
  }, []);

  if (!sessionId) return <div>Loading...</div>;

  return <Terminal sessionId={sessionId} style={{ width: "100%", height: "100vh" }} />;
}
```
