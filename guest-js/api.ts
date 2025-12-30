/**
 * Tauri command wrappers for terminal plugin.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  Screen,
  ScreenUpdate,
  SessionConfig,
  SessionInfo,
  Theme,
} from "./types";

const PLUGIN_NAME = "terminal";

function cmd(name: string): string {
  return `plugin:${PLUGIN_NAME}|${name}`;
}

/**
 * Create a new terminal session.
 */
export async function createSession(config: SessionConfig = {}): Promise<string> {
  return invoke<string>(cmd("create_session"), { config });
}

/**
 * Destroy a terminal session.
 */
export async function destroySession(sessionId: string): Promise<void> {
  return invoke(cmd("destroy_session"), { sessionId });
}

/**
 * List all sessions.
 */
export async function listSessions(): Promise<SessionInfo[]> {
  return invoke<SessionInfo[]>(cmd("list_sessions"));
}

/**
 * Get session info.
 */
export async function getSession(sessionId: string): Promise<SessionInfo> {
  return invoke<SessionInfo>(cmd("get_session"), { sessionId });
}

/**
 * Write string data to a session.
 */
export async function writeToSession(sessionId: string, data: string): Promise<void> {
  return invoke(cmd("write_to_session"), { sessionId, data });
}

/**
 * Write binary data to a session.
 */
export async function writeBytesToSession(sessionId: string, data: number[]): Promise<void> {
  return invoke(cmd("write_bytes_to_session"), { sessionId, data });
}

/**
 * Resize a session.
 */
export async function resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke(cmd("resize_session"), { sessionId, cols, rows });
}

/**
 * Get the full screen state.
 */
export async function getScreen(sessionId: string): Promise<Screen> {
  return invoke<Screen>(cmd("get_screen"), { sessionId });
}

/**
 * Poll for pending output and get updates.
 */
export async function pollSession(sessionId: string): Promise<ScreenUpdate | null> {
  return invoke<ScreenUpdate | null>(cmd("poll_session"), { sessionId });
}

/**
 * Get the theme for a session.
 */
export async function getTheme(sessionId: string): Promise<Theme> {
  return invoke<Theme>(cmd("get_theme"), { sessionId });
}

/**
 * Set the theme for a session.
 */
export async function setTheme(sessionId: string, themeName: string): Promise<void> {
  return invoke(cmd("set_theme"), { sessionId, themeName });
}

/**
 * List available themes.
 */
export async function listThemes(): Promise<string[]> {
  return invoke<string[]>(cmd("list_themes"));
}

/**
 * Get the session count.
 */
export async function getSessionCount(): Promise<number> {
  return invoke<number>(cmd("get_session_count"));
}

/**
 * Terminal API object for convenient access.
 */
export const terminal = {
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
};

export default terminal;
