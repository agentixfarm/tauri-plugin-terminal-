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

  // Apply screen update
  const applyUpdate = useCallback((update: ScreenUpdate) => {
    setScreen((prev) => {
      if (!prev) return prev;

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

  // Resize terminal
  const resize = useCallback(
    async (cols: number, rows: number) => {
      if (!sessionId) return;
      try {
        await api.resizeSession(sessionId, cols, rows);
      } catch (e) {
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
