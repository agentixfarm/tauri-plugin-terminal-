/**
 * tauri-plugin-terminal
 *
 * A high-performance terminal plugin for Tauri applications.
 *
 * @example
 * ```typescript
 * import { terminal } from "@anthropic/tauri-plugin-terminal";
 *
 * // Create a session
 * const sessionId = await terminal.createSession({
 *   cwd: "/home/user",
 *   shell: "/bin/zsh",
 * });
 *
 * // Write to the terminal
 * await terminal.writeToSession(sessionId, "ls -la\n");
 *
 * // Get screen state
 * const screen = await terminal.getScreen(sessionId);
 * ```
 */

// Types
export type {
  Size,
  CursorPosition,
  CursorShape,
  Cursor,
  Color,
  CellAttributes,
  Cell,
  Row,
  Screen,
  CellChange,
  ScreenUpdate,
  MarkType,
  Mark,
  SessionConfig,
  SessionInfo,
  Theme,
  TerminalEvent,
} from "./types";

export { TERMINAL_EVENTS, colorToCss, colorToHex } from "./types";

// API
export {
  createSession,
  destroySession,
  listSessions,
  getSession,
  writeToSession,
  writeBytesToSession,
  resizeSession,
  getScreen,
  pollSession,
  getTheme,
  setTheme,
  listThemes,
  getSessionCount,
  terminal,
} from "./api";

export { terminal as default } from "./api";

// Hooks
export {
  useTerminal,
  useTerminalSession,
  useTerminalSessions,
  useTerminalTheme,
} from "./hooks";
