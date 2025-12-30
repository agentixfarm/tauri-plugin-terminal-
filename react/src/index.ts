/**
 * React components for tauri-plugin-terminal.
 *
 * @example
 * ```tsx
 * import { Terminal } from "@anthropic/tauri-plugin-terminal/react";
 *
 * function App() {
 *   return (
 *     <Terminal
 *       sessionId="my-session"
 *       fontSize={14}
 *       fontFamily="JetBrains Mono"
 *     />
 *   );
 * }
 * ```
 */

export { Terminal, type TerminalProps, type TerminalHandle } from "./Terminal";

// Re-export hooks for convenience
export {
  useTerminal,
  useTerminalSession,
  useTerminalSessions,
  useTerminalTheme,
} from "../../guest-js/hooks";

// Re-export themes
export * from "./themes";
