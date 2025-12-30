/**
 * Terminal React component with canvas rendering.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import { useTerminal, useTerminalTheme } from "../../guest-js/hooks";
import { colorToCss, type Theme, type Screen, type Cursor } from "../../guest-js/types";

export interface TerminalProps {
  /** Session ID to render. */
  sessionId: string;
  /** Font size in pixels. */
  fontSize?: number;
  /** Font family. */
  fontFamily?: string;
  /** Line height multiplier. */
  lineHeight?: number;
  /** Whether the terminal has focus. */
  focused?: boolean;
  /** Called when terminal data is available (for copy). */
  onData?: (data: string) => void;
  /** Called when terminal is resized. */
  onResize?: (cols: number, rows: number) => void;
  /** Called when title changes. */
  onTitleChange?: (title: string) => void;
  /** Called when terminal needs focus. */
  onFocus?: () => void;
  /** Called when terminal loses focus. */
  onBlur?: () => void;
  /** Custom class name. */
  className?: string;
  /** Custom styles. */
  style?: React.CSSProperties;
}

export interface TerminalHandle {
  /** Write data to the terminal. */
  write: (data: string) => Promise<void>;
  /** Resize the terminal. */
  resize: (cols: number, rows: number) => Promise<void>;
  /** Refresh the screen. */
  refresh: () => Promise<void>;
  /** Focus the terminal. */
  focus: () => void;
  /** Get current screen state. */
  getScreen: () => Screen | null;
}

/** Default monospace fonts. */
const DEFAULT_FONT_FAMILY =
  "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace";

/**
 * Terminal component with canvas rendering.
 */
export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  (
    {
      sessionId,
      fontSize = 14,
      fontFamily = DEFAULT_FONT_FAMILY,
      lineHeight = 1.2,
      focused = true,
      onData,
      onResize,
      onTitleChange,
      onFocus,
      onBlur,
      className,
      style,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [charSize, setCharSize] = useState({ width: 0, height: 0 });
    const [selection, setSelection] = useState<{
      start: { row: number; col: number };
      end: { row: number; col: number };
    } | null>(null);

    const { screen, isReady, write, resize, refresh, title } = useTerminal(sessionId);
    const { theme } = useTerminalTheme(sessionId);

    // Measure character size
    useEffect(() => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.font = `${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText("M");
      const width = metrics.width;
      const height = fontSize * lineHeight;

      setCharSize({ width, height });
    }, [fontSize, fontFamily, lineHeight]);

    // Calculate terminal size from container
    const calculateSize = useCallback(() => {
      if (!containerRef.current || charSize.width === 0) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const cols = Math.floor(rect.width / charSize.width);
      const rows = Math.floor(rect.height / charSize.height);

      return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
    }, [charSize]);

    // Handle resize
    useEffect(() => {
      if (!containerRef.current) return;

      const observer = new ResizeObserver(() => {
        const size = calculateSize();
        if (size) {
          resize(size.cols, size.rows);
          onResize?.(size.cols, size.rows);
        }
      });

      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [calculateSize, resize, onResize]);

    // Render to canvas
    useEffect(() => {
      if (!screen || !theme || !canvasRef.current || charSize.width === 0) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size
      const width = screen.size.cols * charSize.width;
      const height = screen.size.rows * charSize.height;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Clear with background
      ctx.fillStyle = colorToCss(theme.background);
      ctx.fillRect(0, 0, width, height);

      // Set font
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "top";

      // Render cells
      for (let row = 0; row < screen.cells.length; row++) {
        const rowCells = screen.cells[row];
        if (!rowCells) continue;

        const y = row * charSize.height;

        for (let col = 0; col < rowCells.length; col++) {
          const cell = rowCells[col];
          if (!cell) continue;

          const x = col * charSize.width;

          // Draw background
          const bgColor = cell.attrs.inverse ? cell.fg : cell.bg;
          ctx.fillStyle = colorToCss(bgColor);
          ctx.fillRect(x, y, charSize.width, charSize.height);

          // Draw character
          if (cell.char && cell.char !== " ") {
            const fgColor = cell.attrs.inverse ? cell.bg : cell.fg;
            ctx.fillStyle = colorToCss(fgColor);

            // Apply text styles
            let fontStyle = "";
            if (cell.attrs.bold) fontStyle += "bold ";
            if (cell.attrs.italic) fontStyle += "italic ";
            ctx.font = `${fontStyle}${fontSize}px ${fontFamily}`;

            ctx.fillText(cell.char, x, y + (charSize.height - fontSize) / 2);

            // Reset font
            if (fontStyle) {
              ctx.font = `${fontSize}px ${fontFamily}`;
            }
          }

          // Draw underline
          if (cell.attrs.underline) {
            const fgColor = cell.attrs.inverse ? cell.bg : cell.fg;
            ctx.strokeStyle = colorToCss(fgColor);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + charSize.height - 2);
            ctx.lineTo(x + charSize.width, y + charSize.height - 2);
            ctx.stroke();
          }

          // Draw strikethrough
          if (cell.attrs.strikethrough) {
            const fgColor = cell.attrs.inverse ? cell.bg : cell.fg;
            ctx.strokeStyle = colorToCss(fgColor);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + charSize.height / 2);
            ctx.lineTo(x + charSize.width, y + charSize.height / 2);
            ctx.stroke();
          }
        }
      }

      // Draw cursor
      if (screen.cursor.visible && focused) {
        const cursorX = screen.cursor.position.col * charSize.width;
        const cursorY = screen.cursor.position.row * charSize.height;

        ctx.fillStyle = colorToCss(theme.cursor);
        ctx.globalAlpha = 0.7;

        switch (screen.cursor.shape) {
          case "block":
            ctx.fillRect(cursorX, cursorY, charSize.width, charSize.height);
            break;
          case "underline":
            ctx.fillRect(cursorX, cursorY + charSize.height - 2, charSize.width, 2);
            break;
          case "bar":
            ctx.fillRect(cursorX, cursorY, 2, charSize.height);
            break;
        }

        ctx.globalAlpha = 1;
      }

      // Draw selection
      if (selection) {
        ctx.fillStyle = colorToCss(theme.selection);
        ctx.globalAlpha = 0.4;

        const startRow = Math.min(selection.start.row, selection.end.row);
        const endRow = Math.max(selection.start.row, selection.end.row);

        for (let row = startRow; row <= endRow; row++) {
          let startCol = 0;
          let endCol = screen.size.cols;

          if (row === selection.start.row && row === selection.end.row) {
            startCol = Math.min(selection.start.col, selection.end.col);
            endCol = Math.max(selection.start.col, selection.end.col);
          } else if (row === startRow) {
            startCol =
              selection.start.row < selection.end.row
                ? selection.start.col
                : selection.end.col;
          } else if (row === endRow) {
            endCol =
              selection.start.row < selection.end.row
                ? selection.end.col
                : selection.start.col;
          }

          ctx.fillRect(
            startCol * charSize.width,
            row * charSize.height,
            (endCol - startCol) * charSize.width,
            charSize.height
          );
        }

        ctx.globalAlpha = 1;
      }
    }, [screen, theme, charSize, fontSize, fontFamily, focused, selection]);

    // Handle keyboard input
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        e.preventDefault();

        let data = "";

        // Handle special keys
        if (e.key === "Enter") {
          data = "\r";
        } else if (e.key === "Backspace") {
          data = "\x7f";
        } else if (e.key === "Tab") {
          data = "\t";
        } else if (e.key === "Escape") {
          data = "\x1b";
        } else if (e.key === "ArrowUp") {
          data = "\x1b[A";
        } else if (e.key === "ArrowDown") {
          data = "\x1b[B";
        } else if (e.key === "ArrowRight") {
          data = "\x1b[C";
        } else if (e.key === "ArrowLeft") {
          data = "\x1b[D";
        } else if (e.key === "Home") {
          data = "\x1b[H";
        } else if (e.key === "End") {
          data = "\x1b[F";
        } else if (e.key === "PageUp") {
          data = "\x1b[5~";
        } else if (e.key === "PageDown") {
          data = "\x1b[6~";
        } else if (e.key === "Delete") {
          data = "\x1b[3~";
        } else if (e.key === "Insert") {
          data = "\x1b[2~";
        } else if (e.ctrlKey && e.key.length === 1) {
          // Ctrl+letter
          const code = e.key.toUpperCase().charCodeAt(0) - 64;
          if (code >= 0 && code <= 31) {
            data = String.fromCharCode(code);
          }
        } else if (e.altKey && e.key.length === 1) {
          // Alt+letter
          data = "\x1b" + e.key;
        } else if (e.key.length === 1) {
          data = e.key;
        }

        if (data) {
          write(data);
        }
      },
      [write]
    );

    // Handle paste
    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        if (text) {
          // Use bracketed paste mode
          write("\x1b[200~" + text + "\x1b[201~");
        }
      },
      [write]
    );

    // Handle mouse selection
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!canvasRef.current || charSize.width === 0) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / charSize.width);
        const row = Math.floor((e.clientY - rect.top) / charSize.height);

        setSelection({ start: { row, col }, end: { row, col } });

        const handleMouseMove = (e: MouseEvent) => {
          const col = Math.floor((e.clientX - rect.left) / charSize.width);
          const row = Math.floor((e.clientY - rect.top) / charSize.height);
          setSelection((prev) =>
            prev ? { ...prev, end: { row, col } } : null
          );
        };

        const handleMouseUp = () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      },
      [charSize]
    );

    // Focus handling
    const handleFocus = useCallback(() => {
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      onBlur?.();
    }, [onBlur]);

    // Title change callback
    useEffect(() => {
      if (title) {
        onTitleChange?.(title);
      }
    }, [title, onTitleChange]);

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        write,
        resize,
        refresh,
        focus: () => inputRef.current?.focus(),
        getScreen: () => screen,
      }),
      [write, resize, refresh, screen]
    );

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: theme ? colorToCss(theme.background) : "#18181b",
          ...style,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
          }}
          onMouseDown={handleMouseDown}
        />
        <textarea
          ref={inputRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            opacity: 0,
            padding: 0,
            border: "none",
            outline: "none",
            resize: "none",
          }}
          autoFocus={focused}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {!isReady && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              color: "white",
            }}
          >
            Loading...
          </div>
        )}
      </div>
    );
  }
);

Terminal.displayName = "Terminal";

export default Terminal;
