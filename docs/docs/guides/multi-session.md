---
sidebar_position: 2
---

# Multi-Session Guide

Run and manage multiple terminal sessions simultaneously.

## Creating Multiple Sessions

Each session is independent with its own:
- PTY process
- Screen buffer
- Scrollback history
- Working directory
- Environment

```typescript
// Create sessions for different purposes
const mainSession = await createSession({ cwd: "/project" });
const buildSession = await createSession({ cwd: "/project" });
const logsSession = await createSession({ cwd: "/var/log" });
```

## Session Management

### Listing Sessions

```typescript
import { listSessions } from "@anthropic/tauri-plugin-terminal";

const sessions = await listSessions();
sessions.forEach((s) => {
  console.log(`${s.id}: ${s.title} (${s.is_alive ? "running" : "stopped"})`);
});
```

### Using the Hook

```tsx
import { useTerminalSessions } from "@anthropic/tauri-plugin-terminal";

function SessionList() {
  const { sessions, isLoading, refresh } = useTerminalSessions();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {sessions.map((session) => (
        <div key={session.id}>
          <span>{session.title || session.id}</span>
          <span>{session.size.cols}x{session.size.rows}</span>
          <span>{session.is_alive ? "🟢" : "🔴"}</span>
        </div>
      ))}
    </div>
  );
}
```

## Tab Interface

Build a tabbed terminal interface:

```tsx
import { useState, useEffect } from "react";
import { Terminal, useTerminalSession, useTerminalSessions } from "@anthropic/tauri-plugin-terminal/react";
import { createSession, destroySession } from "@anthropic/tauri-plugin-terminal";

function TabbedTerminal() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const { sessions, refresh } = useTerminalSessions();

  // Create initial session
  useEffect(() => {
    if (sessions.length === 0) {
      createSession({ cwd: "~" }).then((id) => {
        setActiveTab(id);
        refresh();
      });
    } else if (!activeTab) {
      setActiveTab(sessions[0].id);
    }
  }, [sessions, activeTab, refresh]);

  const handleNewTab = async () => {
    const id = await createSession({ cwd: "~" });
    setActiveTab(id);
    refresh();
  };

  const handleCloseTab = async (id: string) => {
    await destroySession(id);
    refresh();
    if (activeTab === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveTab(remaining[0]?.id || null);
    }
  };

  return (
    <div className="terminal-container">
      {/* Tab bar */}
      <div className="tab-bar">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`tab ${activeTab === session.id ? "active" : ""}`}
            onClick={() => setActiveTab(session.id)}
          >
            <span>{session.title || "Terminal"}</span>
            <button onClick={() => handleCloseTab(session.id)}>×</button>
          </div>
        ))}
        <button onClick={handleNewTab}>+</button>
      </div>

      {/* Terminal panels */}
      <div className="terminal-panels">
        {sessions.map((session) => (
          <div
            key={session.id}
            style={{ display: activeTab === session.id ? "block" : "none" }}
          >
            <Terminal
              sessionId={session.id}
              focused={activeTab === session.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Split Panes

While native split pane support is coming in v0.3.0, you can implement splits with CSS:

```tsx
function SplitTerminal() {
  const [leftSession, setLeftSession] = useState<string | null>(null);
  const [rightSession, setRightSession] = useState<string | null>(null);
  const [split, setSplit] = useState(false);

  useEffect(() => {
    createSession({ cwd: "~" }).then(setLeftSession);
  }, []);

  const handleSplit = async () => {
    if (!split) {
      const id = await createSession({ cwd: "~" });
      setRightSession(id);
      setSplit(true);
    } else {
      if (rightSession) {
        await destroySession(rightSession);
      }
      setRightSession(null);
      setSplit(false);
    }
  };

  return (
    <div className="split-container">
      <button onClick={handleSplit}>
        {split ? "Unsplit" : "Split"}
      </button>
      <div className="split-panes">
        <div style={{ flex: 1 }}>
          {leftSession && (
            <Terminal sessionId={leftSession} />
          )}
        </div>
        {split && rightSession && (
          <div style={{ flex: 1 }}>
            <Terminal sessionId={rightSession} />
          </div>
        )}
      </div>
    </div>
  );
}
```

```css
.split-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.split-panes {
  display: flex;
  flex: 1;
  gap: 2px;
}

.split-panes > div {
  overflow: hidden;
}
```

## Session Persistence

Sessions persist in Rust, so:

1. **Tab switching** - Content preserved when switching tabs
2. **Component unmount** - Content preserved when React unmounts
3. **Multiple views** - Same session can render in multiple components

```tsx
// Both render the same session!
<Terminal sessionId="shared" />
<Terminal sessionId="shared" />
```

## Cleanup

Always destroy sessions when done:

```tsx
useEffect(() => {
  const id = createSession({ cwd: "~" });

  return () => {
    // Cleanup on unmount
    destroySession(id);
  };
}, []);
```

Or listen for process exit:

```tsx
import { listen } from "@tauri-apps/api/event";
import { TERMINAL_EVENTS } from "@anthropic/tauri-plugin-terminal";

useEffect(() => {
  const unlisten = listen(TERMINAL_EVENTS.PROCESS_EXIT, (event) => {
    console.log(`Session ${event.payload.session_id} exited`);
    // Handle cleanup, show restart button, etc.
  });

  return () => unlisten.then((fn) => fn());
}, []);
```
