---
sidebar_position: 2
---

# Advanced Examples

Advanced patterns for tauri-plugin-terminal.

## Tabbed Terminal Manager

Full-featured tabbed terminal implementation:

```tsx
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Terminal,
  TerminalHandle,
  useTerminalSessions,
} from "@anthropic/tauri-plugin-terminal/react";
import {
  createSession,
  destroySession,
  TERMINAL_EVENTS,
} from "@anthropic/tauri-plugin-terminal";
import { listen } from "@tauri-apps/api/event";

interface Tab {
  id: string;
  title: string;
  isAlive: boolean;
}

function TabbedTerminal() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const terminalRefs = useRef<Map<string, TerminalHandle>>(new Map());

  // Create a new tab
  const createTab = useCallback(async () => {
    const id = await createSession({ cwd: "~", theme: "dracula" });
    const tab: Tab = { id, title: "Terminal", isAlive: true };
    setTabs((prev) => [...prev, tab]);
    setActiveTab(id);
    return id;
  }, []);

  // Close a tab
  const closeTab = useCallback(async (id: string) => {
    await destroySession(id);
    terminalRefs.current.delete(id);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTab((current) => {
      if (current === id) {
        const remaining = tabs.filter((t) => t.id !== id);
        return remaining[remaining.length - 1]?.id || null;
      }
      return current;
    });
  }, [tabs]);

  // Update tab title
  const updateTitle = useCallback((id: string, title: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title } : t))
    );
  }, []);

  // Handle process exit
  useEffect(() => {
    const unlisten = listen<{ session_id: string; exit_code?: number }>(
      TERMINAL_EVENTS.PROCESS_EXIT,
      (event) => {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === event.payload.session_id
              ? { ...t, isAlive: false }
              : t
          )
        );
      }
    );
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Create initial tab
  useEffect(() => {
    if (tabs.length === 0) {
      createTab();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "t") {
          e.preventDefault();
          createTab();
        } else if (e.key === "w") {
          e.preventDefault();
          if (activeTab) closeTab(activeTab);
        } else if (e.key >= "1" && e.key <= "9") {
          e.preventDefault();
          const idx = parseInt(e.key) - 1;
          if (tabs[idx]) setActiveTab(tabs[idx].id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, tabs, createTab, closeTab]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        background: "#1e1e2e",
        borderBottom: "1px solid #313244",
        overflowX: "auto",
      }}>
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              cursor: "pointer",
              background: activeTab === tab.id ? "#313244" : "transparent",
              borderRight: "1px solid #313244",
              color: tab.isAlive ? "#cdd6f4" : "#f38ba8",
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.5 }}>{idx + 1}</span>
            <span>{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: 0,
                fontSize: 14,
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={createTab}
          style={{
            background: "none",
            border: "none",
            color: "#cdd6f4",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          +
        </button>
      </div>

      {/* Terminal panels */}
      <div style={{ flex: 1, position: "relative" }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              position: "absolute",
              inset: 0,
              display: activeTab === tab.id ? "block" : "none",
            }}
          >
            <Terminal
              ref={(ref) => {
                if (ref) terminalRefs.current.set(tab.id, ref);
              }}
              sessionId={tab.id}
              focused={activeTab === tab.id}
              onTitleChange={(title) => updateTitle(tab.id, title)}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default TabbedTerminal;
```

## Split Pane Terminal

Horizontal and vertical splits:

```tsx
import { useState, useCallback } from "react";
import { Terminal, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";
import { createSession, destroySession } from "@anthropic/tauri-plugin-terminal";

type SplitDirection = "horizontal" | "vertical" | null;

interface Pane {
  id: string;
  sessionId: string;
}

interface PaneNode {
  type: "pane" | "split";
  direction?: SplitDirection;
  pane?: Pane;
  children?: [PaneNode, PaneNode];
}

function SplitTerminal() {
  const [root, setRoot] = useState<PaneNode | null>(null);
  const [activePane, setActivePane] = useState<string | null>(null);

  const createPane = useCallback(async (): Promise<Pane> => {
    const sessionId = await createSession({ cwd: "~" });
    const id = crypto.randomUUID();
    return { id, sessionId };
  }, []);

  // Initialize
  useEffect(() => {
    createPane().then((pane) => {
      setRoot({ type: "pane", pane });
      setActivePane(pane.id);
    });
  }, []);

  const splitPane = useCallback(async (direction: SplitDirection) => {
    if (!activePane || !root) return;

    const newPane = await createPane();

    const updateNode = (node: PaneNode): PaneNode => {
      if (node.type === "pane" && node.pane?.id === activePane) {
        return {
          type: "split",
          direction,
          children: [
            { type: "pane", pane: node.pane },
            { type: "pane", pane: newPane },
          ],
        };
      }
      if (node.type === "split" && node.children) {
        return {
          ...node,
          children: [updateNode(node.children[0]), updateNode(node.children[1])],
        };
      }
      return node;
    };

    setRoot(updateNode(root));
    setActivePane(newPane.id);
  }, [activePane, root, createPane]);

  const renderNode = (node: PaneNode): JSX.Element => {
    if (node.type === "pane" && node.pane) {
      return (
        <div
          style={{
            flex: 1,
            border: activePane === node.pane.id ? "2px solid #89b4fa" : "1px solid #313244",
          }}
          onClick={() => setActivePane(node.pane!.id)}
        >
          <Terminal
            sessionId={node.pane.sessionId}
            focused={activePane === node.pane.id}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      );
    }

    if (node.type === "split" && node.children) {
      return (
        <div style={{
          display: "flex",
          flex: 1,
          flexDirection: node.direction === "horizontal" ? "row" : "column",
          gap: 2,
        }}>
          {renderNode(node.children[0])}
          {renderNode(node.children[1])}
        </div>
      );
    }

    return <></>;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "d") {
          e.preventDefault();
          splitPane("horizontal");
        } else if (e.shiftKey && e.key === "D") {
          e.preventDefault();
          splitPane("vertical");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [splitPane]);

  if (!root) return <div>Loading...</div>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 8, background: "#1e1e2e" }}>
        <button onClick={() => splitPane("horizontal")}>Split →</button>
        <button onClick={() => splitPane("vertical")}>Split ↓</button>
      </div>
      <div style={{ flex: 1, display: "flex" }}>
        {renderNode(root)}
      </div>
    </div>
  );
}
```

## Command Palette

Quick terminal commands:

```tsx
import { useState, useCallback, useRef, useEffect } from "react";
import { Terminal, TerminalHandle, useTerminalSession } from "@anthropic/tauri-plugin-terminal/react";

const COMMANDS = [
  { name: "Clear", shortcut: "Cmd+K", action: (t: TerminalHandle) => t.write("\x1b[2J\x1b[H") },
  { name: "Git Status", shortcut: "Cmd+G S", action: (t: TerminalHandle) => t.write("git status\n") },
  { name: "Git Diff", shortcut: "Cmd+G D", action: (t: TerminalHandle) => t.write("git diff\n") },
  { name: "List Files", shortcut: "Cmd+L", action: (t: TerminalHandle) => t.write("ls -la\n") },
  { name: "NPM Install", shortcut: "", action: (t: TerminalHandle) => t.write("npm install\n") },
  { name: "NPM Dev", shortcut: "", action: (t: TerminalHandle) => t.write("npm run dev\n") },
];

function TerminalWithPalette() {
  const [showPalette, setShowPalette] = useState(false);
  const [search, setSearch] = useState("");
  const terminalRef = useRef<TerminalHandle>(null);
  const { sessionId, create } = useTerminalSession({ cwd: "~" });

  useEffect(() => { create(); }, []);

  const filteredCommands = COMMANDS.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const runCommand = useCallback((cmd: typeof COMMANDS[0]) => {
    if (terminalRef.current) {
      cmd.action(terminalRef.current);
    }
    setShowPalette(false);
    setSearch("");
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        setShowPalette((v) => !v);
      } else if (e.key === "Escape") {
        setShowPalette(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!sessionId) return <div>Loading...</div>;

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <Terminal
        ref={terminalRef}
        sessionId={sessionId}
        focused={!showPalette}
        style={{ width: "100%", height: "100%" }}
      />

      {showPalette && (
        <div style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          background: "#1e1e2e",
          borderRadius: 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command..."
            style={{
              width: "100%",
              padding: 12,
              border: "none",
              borderBottom: "1px solid #313244",
              background: "transparent",
              color: "#cdd6f4",
              fontSize: 16,
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredCommands[0]) {
                runCommand(filteredCommands[0]);
              }
            }}
          />
          <div style={{ maxHeight: 300, overflow: "auto" }}>
            {filteredCommands.map((cmd, i) => (
              <div
                key={cmd.name}
                onClick={() => runCommand(cmd)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  background: i === 0 ? "#313244" : "transparent",
                  color: "#cdd6f4",
                }}
              >
                <span>{cmd.name}</span>
                <span style={{ opacity: 0.5, fontSize: 12 }}>{cmd.shortcut}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```
