/**
 * TypeScript types for tauri-plugin-terminal.
 */

/** Terminal dimensions. */
export interface Size {
  cols: number;
  rows: number;
}

/** Cursor position. */
export interface CursorPosition {
  row: number;
  col: number;
}

/** Cursor shape variants. */
export type CursorShape = "block" | "underline" | "bar";

/** Cursor state. */
export interface Cursor {
  position: CursorPosition;
  visible: boolean;
  shape: CursorShape;
}

/** RGB color. */
export interface Color {
  r: number;
  g: number;
  b: number;
}

/** Cell attributes. */
export interface CellAttributes {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  inverse: boolean;
  dim: boolean;
  blink: boolean;
}

/** A single terminal cell. */
export interface Cell {
  char: string;
  fg: Color;
  bg: Color;
  attrs: CellAttributes;
}

/** A row of cells. */
export type Row = Cell[];

/** The entire screen buffer. */
export interface Screen {
  cells: Row[];
  cursor: Cursor;
  size: Size;
  scrollback_len: number;
  title: string;
}

/** A change to a single cell. */
export interface CellChange {
  row: number;
  col: number;
  cell: Cell;
}

/** Incremental screen update. */
export interface ScreenUpdate {
  session_id: string;
  changes: CellChange[];
  cursor: Cursor;
  title?: string;
}

/** Shell integration mark type. */
export type MarkType = "prompt_start" | "command_start" | "command_end";

/** Shell integration mark. */
export interface Mark {
  row: number;
  timestamp: number;
  mark_type: MarkType;
  command?: string;
  exit_code?: number;
}

/** Session configuration. */
export interface SessionConfig {
  /** Optional session ID (generated if not provided). */
  id?: string;
  /** Working directory. */
  cwd?: string;
  /** Shell to use. */
  shell?: string;
  /** Environment variables. */
  env?: Record<string, string>;
  /** Initial columns. */
  cols?: number;
  /** Initial rows. */
  rows?: number;
  /** Theme name. */
  theme?: string;
}

/** Session information. */
export interface SessionInfo {
  id: string;
  cwd?: string;
  shell?: string;
  title: string;
  size: Size;
  is_alive: boolean;
  created_at: number;
}

/** Terminal theme. */
export interface Theme {
  name: string;
  foreground: Color;
  background: Color;
  cursor: Color;
  cursor_text: Color;
  selection: Color;
  selection_text: Color;
  black: Color;
  red: Color;
  green: Color;
  yellow: Color;
  blue: Color;
  magenta: Color;
  cyan: Color;
  white: Color;
  bright_black: Color;
  bright_red: Color;
  bright_green: Color;
  bright_yellow: Color;
  bright_blue: Color;
  bright_magenta: Color;
  bright_cyan: Color;
  bright_white: Color;
}

/** Terminal events. */
export type TerminalEvent =
  | { type: "session_created"; session_id: string }
  | { type: "session_destroyed"; session_id: string }
  | { type: "screen_update"; session_id: string; changes: CellChange[]; cursor: Cursor; title?: string }
  | { type: "screen_refresh"; session_id: string; screen: string }
  | { type: "bell"; session_id: string }
  | { type: "title_change"; session_id: string; title: string }
  | { type: "directory_change"; session_id: string; cwd: string }
  | { type: "mark"; session_id: string; mark: Mark }
  | { type: "process_exit"; session_id: string; exit_code?: number }
  | { type: "cursor_move"; session_id: string; cursor: Cursor }
  | { type: "selection_change"; session_id: string; text?: string }
  | { type: "clipboard_request"; session_id: string; content: string }
  | { type: "hyperlink"; session_id: string; url: string; row: number; start_col: number; end_col: number };

/** Event names for Tauri event listeners. */
export const TERMINAL_EVENTS = {
  SESSION_CREATED: "terminal://session-created",
  SESSION_DESTROYED: "terminal://session-destroyed",
  SCREEN_UPDATE: "terminal://screen-update",
  SCREEN_REFRESH: "terminal://screen-refresh",
  BELL: "terminal://bell",
  TITLE_CHANGE: "terminal://title-change",
  DIRECTORY_CHANGE: "terminal://directory-change",
  MARK: "terminal://mark",
  PROCESS_EXIT: "terminal://process-exit",
  CURSOR_MOVE: "terminal://cursor-move",
  SELECTION_CHANGE: "terminal://selection-change",
  CLIPBOARD_REQUEST: "terminal://clipboard-request",
  HYPERLINK: "terminal://hyperlink",
} as const;

/** Convert Color to CSS rgb string. */
export function colorToCss(color: Color): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/** Convert Color to hex string. */
export function colorToHex(color: Color): string {
  return `#${color.r.toString(16).padStart(2, "0")}${color.g.toString(16).padStart(2, "0")}${color.b.toString(16).padStart(2, "0")}`;
}
