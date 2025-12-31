/**
 * React hooks for terminal plugin.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import * as api from "./api";
import type {
  Screen,
  ScreenUpdate,
  SessionConfig,
  SessionInfo,
  Cursor,
  CellChange,
  TerminalEvent,
  Theme,
} from "./types";
import { TERMINAL_EVENTS } from "./types";

/**
 * Hook for managing a terminal session.
 */
export function useTerminal(sessionId: string | null) {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [title, setTitle] = useState("");
  const [isAlive, setIsAlive] = useState(true);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  // Apply screen update - handles both incremental updates and full refreshes
  const applyUpdate = useCallback((update: ScreenUpdate) => {
    setScreen((prev) => {
      if (!prev) return prev;

      // Check if screen size changed - if so, we need to rebuild cells array
      const sizeChanged = update.changes.some(
        (change) =>
          change.row >= prev.cells.length ||
          (prev.cells[change.row] && change.col >= prev.cells[change.row].length)
      );

      if (sizeChanged) {
        // Size changed, need to expand or rebuild the cells array
        // Find max dimensions from changes
        let maxRow = prev.cells.length - 1;
        let maxCol = prev.cells[0]?.length - 1 || 0;

        for (const change of update.changes) {
          if (change.row > maxRow) maxRow = change.row;
          if (change.col > maxCol) maxCol = change.col;
        }

        // Create new cells array with proper dimensions
        const newCells = [];
        for (let row = 0; row <= maxRow; row++) {
          const newRow = [];
          for (let col = 0; col <= maxCol; col++) {
            // Copy existing cell or create empty
            newRow.push(prev.cells[row]?.[col] || { char: '', fg: { r: 255, g: 255, b: 255 }, bg: { r: 0, g: 0, b: 0 }, attrs: {} });
          }
          newCells.push(newRow);
        }

        // Apply changes
        for (const change of update.changes) {
          if (newCells[change.row]) {
            newCells[change.row][change.col] = change.cell;
          }
        }

        return {
          ...prev,
          cells: newCells,
          cursor: update.cursor,
          title: update.title ?? prev.title,
          size: { cols: maxCol + 1, rows: maxRow + 1 },
        };
      }

      // Normal incremental update
      const newCells = [...prev.cells.map((row) => [...row])];
      for (const change of update.changes) {
        if (newCells[change.row]) {
          newCells[change.row][change.col] = change.cell;
        }
      }

      return {
        ...prev,
        cells: newCells,
        cursor: update.cursor,
        title: update.title ?? prev.title,
      };
    });

    if (update.title) {
      setTitle(update.title);
    }
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!sessionId) return;

    const setupListeners = async () => {
      // Screen update
      const unlistenScreen = await listen<ScreenUpdate>(
        TERMINAL_EVENTS.SCREEN_UPDATE,
        (event) => {
          if (event.payload.session_id === sessionId) {
            applyUpdate(event.payload);
          }
        }
      );
      unlistenRef.current.push(unlistenScreen);

      // Title change
      const unlistenTitle = await listen<{ session_id: string; title: string }>(
        TERMINAL_EVENTS.TITLE_CHANGE,
        (event) => {
          if (event.payload.session_id === sessionId) {
            setTitle(event.payload.title);
          }
        }
      );
      unlistenRef.current.push(unlistenTitle);

      // Process exit
      const unlistenExit = await listen<{ session_id: string; exit_code?: number }>(
        TERMINAL_EVENTS.PROCESS_EXIT,
        (event) => {
          if (event.payload.session_id === sessionId) {
            setIsAlive(false);
          }
        }
      );
      unlistenRef.current.push(unlistenExit);
    };

    setupListeners();

    return () => {
      unlistenRef.current.forEach((unlisten) => unlisten());
      unlistenRef.current = [];
    };
  }, [sessionId, applyUpdate]);

  // Fetch initial screen
  useEffect(() => {
    if (!sessionId) {
      setScreen(null);
      setIsReady(false);
      return;
    }

    const fetchScreen = async () => {
      try {
        const s = await api.getScreen(sessionId);
        setScreen(s);
        setTitle(s.title);
        setIsReady(true);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setIsReady(false);
      }
    };

    fetchScreen();
  }, [sessionId]);

  // Write to terminal
  const write = useCallback(
    async (data: string) => {
      if (!sessionId) return;
      try {
        await api.writeToSession(sessionId, data);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [sessionId]
  );

  // Resize terminal with confirmation and retry logic
  const resize = useCallback(
    async (cols: number, rows: number) => {
      if (!sessionId) return;
      try {
        console.log(`[useTerminal] resize: requesting ${cols}x${rows} for session=${sessionId}`);

        // Set up a promise that resolves when we receive resize confirmation
        const resizePromise = new Promise<void>((resolve) => {
          const handleResize = async (event: { payload: { session_id: string; cols: number; rows: number } }) => {
            console.log(`[useTerminal] resize: received confirmation event ${event.payload.cols}x${event.payload.rows}`);
            if (event.payload.session_id === sessionId &&
                event.payload.cols === cols &&
                event.payload.rows === rows) {
              unlisten();
              resolve();
            }
          };

          let unlisten: () => void = () => {};
          listen<{ session_id: string; cols: number; rows: number }>(
            TERMINAL_EVENTS.TERMINAL_RESIZED,
            handleResize
          ).then((fn) => {
            unlisten = fn;
          });

          // Timeout after 500ms and resolve anyway
          setTimeout(() => {
            unlisten();
            resolve();
          }, 500);
        });

        await api.resizeSession(sessionId, cols, rows);

        // Wait for resize confirmation or timeout
        await resizePromise;

        // Retry fetching screen until it matches expected size or max retries
        const maxRetries = 8;
        const retryDelays = [10, 20, 50, 100, 150, 200, 300, 500];

        for (let i = 0; i < maxRetries; i++) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[i]));

          const s = await api.getScreen(sessionId);
          console.log(`[useTerminal] resize: retry ${i+1}/${maxRetries}, got screen ${s.size.cols}x${s.size.rows}, cells=${s.cells[0]?.length || 0}x${s.cells.length}`);

          // Check if screen size matches what we requested
          if (s.size.cols === cols && s.size.rows === rows) {
            console.log(`[useTerminal] resize: size matches, updating screen`);
            setScreen(s);
            return;
          }

          // If this is the last retry, use whatever we got but log a warning
          if (i === maxRetries - 1) {
            console.warn(`[useTerminal] resize: final retry, using screen ${s.size.cols}x${s.size.rows} (requested ${cols}x${rows})`);
            setScreen(s);
          }
        }
      } catch (e) {
        console.error(`[useTerminal] resize error:`, e);
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [sessionId]
  );

  // Refresh screen
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await api.getScreen(sessionId);
      setScreen(s);
      setTitle(s.title);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [sessionId]);

  return {
    screen,
    isReady,
    error,
    title,
    isAlive,
    write,
    resize,
    refresh,
  };
}

/**
 * Hook for creating and managing a terminal session.
 */
export function useTerminalSession(config: SessionConfig = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<Error | null>(null);

  const terminal = useTerminal(sessionId);

  // Create session
  const create = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const id = await api.createSession(config);
      setSessionId(id);
      return id;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      setCreateError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [config, isCreating]);

  // Destroy session
  const destroy = useCallback(async () => {
    if (!sessionId) return;
    try {
      await api.destroySession(sessionId);
      setSessionId(null);
    } catch (e) {
      setCreateError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [sessionId]);

  // Auto-create on mount if config has autoCreate
  useEffect(() => {
    if ((config as any).autoCreate && !sessionId && !isCreating) {
      create();
    }
  }, []);

  return {
    ...terminal,
    sessionId,
    isCreating,
    createError,
    create,
    destroy,
  };
}

/**
 * Hook for listing all sessions.
 */
export function useTerminalSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  // Refresh sessions list
  const refresh = useCallback(async () => {
    try {
      const list = await api.listSessions();
      setSessions(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, []);

  // Set up listeners
  useEffect(() => {
    const setup = async () => {
      // Listen for session created
      const unlistenCreate = await listen<{ session_id: string }>(
        TERMINAL_EVENTS.SESSION_CREATED,
        () => refresh()
      );
      unlistenRef.current.push(unlistenCreate);

      // Listen for session destroyed
      const unlistenDestroy = await listen<{ session_id: string }>(
        TERMINAL_EVENTS.SESSION_DESTROYED,
        () => refresh()
      );
      unlistenRef.current.push(unlistenDestroy);

      // Initial fetch
      await refresh();
      setIsLoading(false);
    };

    setup();

    return () => {
      unlistenRef.current.forEach((unlisten) => unlisten());
      unlistenRef.current = [];
    };
  }, [refresh]);

  return {
    sessions,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook for theme management.
 */
export function useTerminalTheme(sessionId: string | null) {
  const [theme, setThemeState] = useState<Theme | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch theme
  useEffect(() => {
    if (!sessionId) {
      setThemeState(null);
      return;
    }

    const fetchTheme = async () => {
      try {
        const t = await api.getTheme(sessionId);
        setThemeState(t);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    };

    fetchTheme();
  }, [sessionId]);

  // Fetch available themes
  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const list = await api.listThemes();
        setThemes(list);
        setIsLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setIsLoading(false);
      }
    };

    fetchThemes();
  }, []);

  // Set theme
  const setTheme = useCallback(
    async (themeName: string) => {
      if (!sessionId) return;
      try {
        await api.setTheme(sessionId, themeName);
        const t = await api.getTheme(sessionId);
        setThemeState(t);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [sessionId]
  );

  return {
    theme,
    themes,
    isLoading,
    error,
    setTheme,
  };
}
