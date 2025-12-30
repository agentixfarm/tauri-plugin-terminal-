/**
 * Terminal React component with canvas rendering.
 * Enhanced with iTerm2/Oh-My-Zsh-like features:
 * - Sharp text rendering (Retina/DPR support)
 * - Scrollback with scroll wheel navigation
 * - Text selection and copy to clipboard
 * - URL/link detection and click handling
 * - Ctrl+F search functionality
 * - Multiple cursor shapes
 * - Double buffering for smooth rendering
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
  useMemo,
} from "react";
import { useTerminal, useTerminalTheme } from "../../guest-js/hooks";
import { colorToCss, type Theme, type Screen, type Cursor, type Cell } from "../../guest-js/types";

export interface TerminalProps {
  /** Session ID to render. */
  sessionId: string;
  /** Font size in pixels. */
  fontSize?: number;
  /** Font family. */
  fontFamily?: string;
  /** Line height multiplier. */
  lineHeight?: number;
  /** Letter spacing in pixels. */
  letterSpacing?: number;
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
  /** Called when a link is clicked. */
  onLinkClick?: (url: string) => void;
  /** Enable scrollback navigation. */
  enableScrollback?: boolean;
  /** Enable URL detection. */
  enableLinkDetection?: boolean;
  /** Enable search (Ctrl+F). */
  enableSearch?: boolean;
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
  /** Copy selected text to clipboard. */
  copySelection: () => Promise<string | null>;
  /** Open search dialog. */
  openSearch: () => void;
  /** Close search dialog. */
  closeSearch: () => void;
  /** Scroll to top of scrollback. */
  scrollToTop: () => void;
  /** Scroll to bottom (live view). */
  scrollToBottom: () => void;
}

interface Selection {
  start: { row: number; col: number };
  end: { row: number; col: number };
}

interface DetectedLink {
  url: string;
  row: number;
  startCol: number;
  endCol: number;
}

interface SearchResult {
  row: number;
  startCol: number;
  endCol: number;
  text: string;
}

/** Default monospace fonts - iTerm2 style. */
const DEFAULT_FONT_FAMILY =
  "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace";

/** URL detection regex pattern. */
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+/gi;

/** File path detection regex pattern (Unix-style). */
const PATH_REGEX = /(?:^|\s)(\/[^\s:*?"<>|]+)/g;

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
      letterSpacing = 0,
      focused = true,
      onData,
      onResize,
      onTitleChange,
      onFocus,
      onBlur,
      onLinkClick,
      enableScrollback = true,
      enableLinkDetection = true,
      enableSearch = true,
      className,
      style,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [charSize, setCharSize] = useState({ width: 0, height: 0 });
    const [selection, setSelection] = useState<Selection | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [detectedLinks, setDetectedLinks] = useState<DetectedLink[]>([]);
    const [hoveredLink, setHoveredLink] = useState<DetectedLink | null>(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [cursorBlink, setCursorBlink] = useState(true);

    const { screen, isReady, write, resize, refresh, title } = useTerminal(sessionId);
    const { theme } = useTerminalTheme(sessionId);

    // Create offscreen canvas for double buffering
    useEffect(() => {
      offscreenCanvasRef.current = document.createElement("canvas");
    }, []);

    // Cursor blink effect
    useEffect(() => {
      if (!focused) return;
      const interval = setInterval(() => {
        setCursorBlink((prev) => !prev);
      }, 530);
      return () => clearInterval(interval);
    }, [focused]);

    // Measure character size with sub-pixel precision
    useEffect(() => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.font = `${fontSize}px ${fontFamily}`;

      // Measure multiple characters for accuracy
      const testChars = "MMMMMMMMMM";
      const metrics = ctx.measureText(testChars);
      const width = metrics.width / testChars.length + letterSpacing;
      const height = fontSize * lineHeight;

      setCharSize({ width, height });
    }, [fontSize, fontFamily, lineHeight, letterSpacing]);

    // Detect URLs in visible content
    useEffect(() => {
      if (!enableLinkDetection || !screen) return;

      const links: DetectedLink[] = [];

      screen.cells.forEach((row, rowIndex) => {
        const rowText = row.map((cell) => cell.char || " ").join("");

        // Find URLs
        let match;
        URL_REGEX.lastIndex = 0;
        while ((match = URL_REGEX.exec(rowText)) !== null) {
          links.push({
            url: match[0],
            row: rowIndex,
            startCol: match.index,
            endCol: match.index + match[0].length,
          });
        }

        // Find file paths
        PATH_REGEX.lastIndex = 0;
        while ((match = PATH_REGEX.exec(rowText)) !== null) {
          const path = match[1];
          const startCol = match.index + match[0].indexOf(path);
          links.push({
            url: `file://${path}`,
            row: rowIndex,
            startCol,
            endCol: startCol + path.length,
          });
        }
      });

      setDetectedLinks(links);
    }, [screen, enableLinkDetection]);

    // Search functionality
    useEffect(() => {
      if (!searchQuery || !screen) {
        setSearchResults([]);
        return;
      }

      const results: SearchResult[] = [];
      const query = searchQuery.toLowerCase();

      screen.cells.forEach((row, rowIndex) => {
        const rowText = row.map((cell) => cell.char || " ").join("");
        const lowerRowText = rowText.toLowerCase();

        let startIndex = 0;
        let foundIndex;
        while ((foundIndex = lowerRowText.indexOf(query, startIndex)) !== -1) {
          results.push({
            row: rowIndex,
            startCol: foundIndex,
            endCol: foundIndex + query.length,
            text: rowText.substring(foundIndex, foundIndex + query.length),
          });
          startIndex = foundIndex + 1;
        }
      });

      setSearchResults(results);
      if (results.length > 0) {
        setCurrentSearchIndex(0);
      }
    }, [searchQuery, screen]);

    // Calculate terminal size from container
    const calculateSize = useCallback(() => {
      if (!containerRef.current || charSize.width === 0) return null;

      const rect = containerRef.current.getBoundingClientRect();
      // Account for scrollbar width (12px)
      const availableWidth = rect.width - (enableScrollback ? 12 : 0);
      const cols = Math.floor(availableWidth / charSize.width);
      const rows = Math.floor(rect.height / charSize.height);

      return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
    }, [charSize, enableScrollback]);

    // Track last size to avoid unnecessary resizes
    const lastSizeRef = useRef<{ cols: number; rows: number } | null>(null);

    // Handle resize with improved debouncing
    useEffect(() => {
      if (!containerRef.current || charSize.width === 0) return;

      let resizeTimeout: NodeJS.Timeout | null = null;
      let rafId: number | null = null;

      const handleResize = async () => {
        const size = calculateSize();
        if (size && size.cols > 0 && size.rows > 0) {
          // Skip if size hasn't changed
          if (
            lastSizeRef.current?.cols === size.cols &&
            lastSizeRef.current?.rows === size.rows
          ) {
            return;
          }
          lastSizeRef.current = size;

          await resize(size.cols, size.rows);
          onResize?.(size.cols, size.rows);
        }
      };

      const debouncedResize = () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        if (rafId) cancelAnimationFrame(rafId);

        resizeTimeout = setTimeout(() => {
          rafId = requestAnimationFrame(() => {
            handleResize();
          });
        }, 50);
      };

      const observer = new ResizeObserver(debouncedResize);
      observer.observe(containerRef.current);

      // Initial resize
      handleResize();

      return () => {
        observer.disconnect();
        if (resizeTimeout) clearTimeout(resizeTimeout);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }, [calculateSize, resize, onResize, charSize.width]);

    // Render cell helper
    const renderCell = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        cell: Cell,
        x: number,
        y: number,
        isHighlighted: boolean = false
      ) => {
        // Draw background
        let bgColor = cell.attrs.inverse ? cell.fg : cell.bg;
        if (isHighlighted) {
          bgColor = theme?.selection || { r: 100, g: 100, b: 200 };
        }
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

          // Center text vertically
          const textY = y + (charSize.height - fontSize) / 2 + fontSize * 0.85;
          ctx.fillText(cell.char, x, textY);
        }

        // Draw underline
        if (cell.attrs.underline) {
          const fgColor = cell.attrs.inverse ? cell.bg : cell.fg;
          ctx.strokeStyle = colorToCss(fgColor);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + charSize.height - 1.5);
          ctx.lineTo(x + charSize.width, y + charSize.height - 1.5);
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

        // Draw dim effect
        if (cell.attrs.dim) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = colorToCss(cell.bg);
          ctx.fillRect(x, y, charSize.width, charSize.height);
          ctx.globalAlpha = 1;
        }
      },
      [charSize, fontSize, fontFamily, theme]
    );

    // Check if cell is in selection
    const isCellSelected = useCallback(
      (row: number, col: number): boolean => {
        if (!selection) return false;

        const startRow = Math.min(selection.start.row, selection.end.row);
        const endRow = Math.max(selection.start.row, selection.end.row);

        if (row < startRow || row > endRow) return false;

        const startCol = selection.start.row < selection.end.row
          ? selection.start.col
          : selection.end.col;
        const endCol = selection.start.row < selection.end.row
          ? selection.end.col
          : selection.start.col;

        if (row === startRow && row === endRow) {
          const minCol = Math.min(selection.start.col, selection.end.col);
          const maxCol = Math.max(selection.start.col, selection.end.col);
          return col >= minCol && col < maxCol;
        }

        if (row === startRow) {
          return col >= startCol;
        }

        if (row === endRow) {
          return col < endCol;
        }

        return true;
      },
      [selection]
    );

    // Check if cell is in search result
    const getCellSearchHighlight = useCallback(
      (row: number, col: number): "current" | "match" | null => {
        for (let i = 0; i < searchResults.length; i++) {
          const result = searchResults[i];
          if (
            result.row === row &&
            col >= result.startCol &&
            col < result.endCol
          ) {
            return i === currentSearchIndex ? "current" : "match";
          }
        }
        return null;
      },
      [searchResults, currentSearchIndex]
    );

    // Render to canvas using double buffering
    useEffect(() => {
      if (
        !screen ||
        !theme ||
        !canvasRef.current ||
        !containerRef.current ||
        !offscreenCanvasRef.current ||
        charSize.width === 0
      )
        return;

      const canvas = canvasRef.current;
      const offscreen = offscreenCanvasRef.current;
      const ctx = canvas.getContext("2d", { alpha: false });
      const offCtx = offscreen.getContext("2d", { alpha: false });
      if (!ctx || !offCtx) return;

      // Handle device pixel ratio for sharp text on Retina displays
      const dpr = window.devicePixelRatio || 1;

      // Get container size
      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollbarWidth = enableScrollback ? 12 : 0;
      const width = containerRect.width - scrollbarWidth;
      const height = containerRect.height;

      // Set canvas sizes
      const scaledWidth = Math.ceil(width * dpr);
      const scaledHeight = Math.ceil(height * dpr);

      if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        offscreen.width = scaledWidth;
        offscreen.height = scaledHeight;
      }

      // Reset transform and scale for DPR on offscreen canvas
      offCtx.resetTransform();
      offCtx.scale(dpr, dpr);

      // Clear with background
      offCtx.fillStyle = colorToCss(theme.background);
      offCtx.fillRect(0, 0, width, height);

      // Set font
      offCtx.font = `${fontSize}px ${fontFamily}`;
      offCtx.textBaseline = "alphabetic";
      offCtx.imageSmoothingEnabled = false;

      // Render cells
      for (let row = 0; row < screen.cells.length; row++) {
        const rowCells = screen.cells[row];
        if (!rowCells) continue;

        const y = row * charSize.height;

        for (let col = 0; col < rowCells.length; col++) {
          const cell = rowCells[col];
          if (!cell) continue;

          const x = col * charSize.width;
          const selected = isCellSelected(row, col);
          const searchHighlight = getCellSearchHighlight(row, col);

          // Render cell with appropriate highlight
          if (searchHighlight === "current") {
            offCtx.fillStyle = "#ff9500";
            offCtx.fillRect(x, y, charSize.width, charSize.height);
            offCtx.fillStyle = "#000";
            if (cell.char && cell.char !== " ") {
              offCtx.fillText(cell.char, x, y + charSize.height * 0.85);
            }
          } else if (searchHighlight === "match") {
            offCtx.fillStyle = "#ffff00";
            offCtx.globalAlpha = 0.4;
            offCtx.fillRect(x, y, charSize.width, charSize.height);
            offCtx.globalAlpha = 1;
            renderCell(offCtx, cell, x, y, false);
          } else {
            renderCell(offCtx, cell, x, y, selected);
          }
        }
      }

      // Draw detected links (underline on hover)
      if (enableLinkDetection) {
        detectedLinks.forEach((link) => {
          const isHovered = hoveredLink === link;
          offCtx.strokeStyle = isHovered ? "#3b82f6" : "#6b7280";
          offCtx.lineWidth = isHovered ? 2 : 1;
          offCtx.beginPath();
          const y = link.row * charSize.height + charSize.height - 2;
          offCtx.moveTo(link.startCol * charSize.width, y);
          offCtx.lineTo(link.endCol * charSize.width, y);
          offCtx.stroke();
        });
      }

      // Draw cursor
      if (screen.cursor.visible && focused && cursorBlink) {
        const cursorX = screen.cursor.position.col * charSize.width;
        const cursorY = screen.cursor.position.row * charSize.height;

        offCtx.fillStyle = colorToCss(theme.cursor);

        switch (screen.cursor.shape) {
          case "block":
            offCtx.globalAlpha = 0.8;
            offCtx.fillRect(cursorX, cursorY, charSize.width, charSize.height);
            // Draw character on top of block cursor in cursor text color
            const cursorCell = screen.cells[screen.cursor.position.row]?.[screen.cursor.position.col];
            if (cursorCell?.char && cursorCell.char !== " ") {
              offCtx.fillStyle = colorToCss(theme.cursor_text);
              offCtx.fillText(
                cursorCell.char,
                cursorX,
                cursorY + charSize.height * 0.85
              );
            }
            offCtx.globalAlpha = 1;
            break;
          case "underline":
            offCtx.fillRect(cursorX, cursorY + charSize.height - 3, charSize.width, 3);
            break;
          case "bar":
            offCtx.fillRect(cursorX, cursorY, 2, charSize.height);
            break;
        }
      }

      // Draw selection overlay
      if (selection && !isSelecting) {
        offCtx.fillStyle = colorToCss(theme.selection);
        offCtx.globalAlpha = 0.35;

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

          offCtx.fillRect(
            startCol * charSize.width,
            row * charSize.height,
            (endCol - startCol) * charSize.width,
            charSize.height
          );
        }

        offCtx.globalAlpha = 1;
      }

      // Copy offscreen to visible canvas
      ctx.resetTransform();
      ctx.drawImage(offscreen, 0, 0);
    }, [
      screen,
      theme,
      charSize,
      fontSize,
      fontFamily,
      focused,
      selection,
      isSelecting,
      detectedLinks,
      hoveredLink,
      searchResults,
      currentSearchIndex,
      cursorBlink,
      enableScrollback,
      enableLinkDetection,
      renderCell,
      isCellSelected,
      getCellSearchHighlight,
    ]);

    // Extract selected text
    const getSelectedText = useCallback((): string => {
      if (!selection || !screen) return "";

      const lines: string[] = [];
      const startRow = Math.min(selection.start.row, selection.end.row);
      const endRow = Math.max(selection.start.row, selection.end.row);

      for (let row = startRow; row <= endRow; row++) {
        const rowCells = screen.cells[row];
        if (!rowCells) continue;

        let startCol = 0;
        let endCol = rowCells.length;

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

        const line = rowCells
          .slice(startCol, endCol)
          .map((cell) => cell.char || " ")
          .join("")
          .trimEnd();
        lines.push(line);
      }

      return lines.join("\n");
    }, [selection, screen]);

    // Copy selection to clipboard
    const copySelection = useCallback(async (): Promise<string | null> => {
      const text = getSelectedText();
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          onData?.(text);
          return text;
        } catch (e) {
          console.error("Failed to copy to clipboard:", e);
        }
      }
      return null;
    }, [getSelectedText, onData]);

    // Handle keyboard input
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        // Handle search toggle
        if (enableSearch && e.ctrlKey && e.key === "f") {
          e.preventDefault();
          setSearchVisible(true);
          setTimeout(() => searchInputRef.current?.focus(), 0);
          return;
        }

        // Handle copy
        if ((e.ctrlKey || e.metaKey) && e.key === "c" && selection) {
          e.preventDefault();
          copySelection();
          return;
        }

        // Handle paste
        if ((e.ctrlKey || e.metaKey) && e.key === "v") {
          // Let the paste event handle this
          return;
        }

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
          setSelection(null);
          setSearchVisible(false);
        } else if (e.key === "ArrowUp") {
          data = "\x1b[A";
        } else if (e.key === "ArrowDown") {
          data = "\x1b[B";
        } else if (e.key === "ArrowRight") {
          data = "\x1b[C";
        } else if (e.key === "ArrowLeft") {
          data = "\x1b[D";
        } else if (e.key === "Home") {
          data = e.ctrlKey ? "\x1b[1;5H" : "\x1b[H";
        } else if (e.key === "End") {
          data = e.ctrlKey ? "\x1b[1;5F" : "\x1b[F";
        } else if (e.key === "PageUp") {
          data = "\x1b[5~";
        } else if (e.key === "PageDown") {
          data = "\x1b[6~";
        } else if (e.key === "Delete") {
          data = "\x1b[3~";
        } else if (e.key === "Insert") {
          data = "\x1b[2~";
        } else if (e.key.startsWith("F") && e.key.length > 1) {
          // Function keys F1-F12
          const fNum = parseInt(e.key.slice(1));
          if (fNum >= 1 && fNum <= 12) {
            const fKeys = [
              "\x1bOP", "\x1bOQ", "\x1bOR", "\x1bOS",
              "\x1b[15~", "\x1b[17~", "\x1b[18~", "\x1b[19~",
              "\x1b[20~", "\x1b[21~", "\x1b[23~", "\x1b[24~",
            ];
            data = fKeys[fNum - 1];
          }
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
          setSelection(null);
        }
      },
      [write, enableSearch, selection, copySelection]
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

        // Check for link click with Cmd/Ctrl held
        if ((e.metaKey || e.ctrlKey) && enableLinkDetection) {
          const link = detectedLinks.find(
            (l) => l.row === row && col >= l.startCol && col < l.endCol
          );
          if (link) {
            onLinkClick?.(link.url);
            return;
          }
        }

        // Double-click for word selection
        if (e.detail === 2 && screen) {
          const rowCells = screen.cells[row];
          if (rowCells) {
            const text = rowCells.map((c) => c.char || " ").join("");
            // Find word boundaries
            let startCol = col;
            let endCol = col;
            while (startCol > 0 && /\w/.test(text[startCol - 1])) startCol--;
            while (endCol < text.length && /\w/.test(text[endCol])) endCol++;
            setSelection({ start: { row, col: startCol }, end: { row, col: endCol } });
            return;
          }
        }

        // Triple-click for line selection
        if (e.detail === 3 && screen) {
          const rowCells = screen.cells[row];
          if (rowCells) {
            setSelection({ start: { row, col: 0 }, end: { row, col: rowCells.length } });
            return;
          }
        }

        setSelection({ start: { row, col }, end: { row, col } });
        setIsSelecting(true);

        const handleMouseMove = (e: MouseEvent) => {
          const col = Math.max(0, Math.floor((e.clientX - rect.left) / charSize.width));
          const row = Math.max(0, Math.floor((e.clientY - rect.top) / charSize.height));
          setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
        };

        const handleMouseUp = () => {
          setIsSelecting(false);
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      },
      [charSize, screen, enableLinkDetection, detectedLinks, onLinkClick]
    );

    // Handle mouse move for link hover
    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (!canvasRef.current || !enableLinkDetection || charSize.width === 0) {
          setHoveredLink(null);
          return;
        }

        const rect = canvasRef.current.getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / charSize.width);
        const row = Math.floor((e.clientY - rect.top) / charSize.height);

        const link = detectedLinks.find(
          (l) => l.row === row && col >= l.startCol && col < l.endCol
        );
        setHoveredLink(link || null);
      },
      [charSize, enableLinkDetection, detectedLinks]
    );

    // Handle scroll wheel for scrollback
    const handleWheel = useCallback(
      (e: React.WheelEvent) => {
        if (!enableScrollback) return;

        const delta = e.deltaY > 0 ? 3 : -3;
        setScrollOffset((prev) => Math.max(0, prev + delta));
      },
      [enableScrollback]
    );

    // Search navigation
    const navigateSearch = useCallback(
      (direction: "next" | "prev") => {
        if (searchResults.length === 0) return;

        setCurrentSearchIndex((prev) => {
          if (direction === "next") {
            return (prev + 1) % searchResults.length;
          } else {
            return prev === 0 ? searchResults.length - 1 : prev - 1;
          }
        });
      },
      [searchResults.length]
    );

    // Handle search input
    const handleSearchKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          navigateSearch(e.shiftKey ? "prev" : "next");
        } else if (e.key === "Escape") {
          e.preventDefault();
          setSearchVisible(false);
          setSearchQuery("");
          inputRef.current?.focus();
        }
      },
      [navigateSearch]
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
        copySelection,
        openSearch: () => {
          setSearchVisible(true);
          setTimeout(() => searchInputRef.current?.focus(), 0);
        },
        closeSearch: () => {
          setSearchVisible(false);
          setSearchQuery("");
        },
        scrollToTop: () => setScrollOffset(screen?.scrollback_len || 0),
        scrollToBottom: () => setScrollOffset(0),
      }),
      [write, resize, refresh, screen, copySelection]
    );

    // Scrollbar component
    const scrollbarHeight = useMemo(() => {
      if (!screen || !enableScrollback) return 0;
      const totalLines = screen.size.rows + screen.scrollback_len;
      const viewportRatio = screen.size.rows / totalLines;
      return Math.max(20, viewportRatio * 100);
    }, [screen, enableScrollback]);

    const scrollbarPosition = useMemo(() => {
      if (!screen || !enableScrollback) return 100;
      const totalLines = screen.size.rows + screen.scrollback_len;
      const position = ((totalLines - scrollOffset - screen.size.rows) / totalLines) * 100;
      return Math.max(0, Math.min(100 - scrollbarHeight, position));
    }, [screen, scrollOffset, scrollbarHeight, enableScrollback]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
          backgroundColor: theme ? colorToCss(theme.background) : "#18181b",
          fontFamily,
          ...style,
        }}
        onClick={() => inputRef.current?.focus()}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            cursor: hoveredLink ? "pointer" : "text",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onClick={() => inputRef.current?.focus()}
        />

        {/* Scrollbar */}
        {enableScrollback && screen && screen.scrollback_len > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 10,
              height: "100%",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: `${scrollbarPosition}%`,
                right: 2,
                width: 6,
                height: `${scrollbarHeight}%`,
                minHeight: 20,
                backgroundColor: "rgba(255, 255, 255, 0.3)",
                borderRadius: 3,
                transition: "background-color 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
              }}
            />
          </div>
        )}

        {/* Search box */}
        {enableSearch && searchVisible && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              backgroundColor: "rgba(30, 30, 30, 0.95)",
              borderRadius: 6,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search..."
              style={{
                width: 200,
                padding: "4px 8px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 4,
                color: "#fff",
                fontSize: 13,
                outline: "none",
              }}
            />
            <span style={{ color: "#888", fontSize: 12, minWidth: 60 }}>
              {searchResults.length > 0
                ? `${currentSearchIndex + 1}/${searchResults.length}`
                : "No results"}
            </span>
            <button
              onClick={() => navigateSearch("prev")}
              style={{
                padding: "2px 8px",
                backgroundColor: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 4,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ↑
            </button>
            <button
              onClick={() => navigateSearch("next")}
              style={{
                padding: "2px 8px",
                backgroundColor: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 4,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ↓
            </button>
            <button
              onClick={() => {
                setSearchVisible(false);
                setSearchQuery("");
                inputRef.current?.focus();
              }}
              style={{
                padding: "2px 8px",
                backgroundColor: "transparent",
                border: "none",
                color: "#888",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Hidden textarea for input */}
        <textarea
          ref={inputRef}
          style={{
            position: "absolute",
            top: -9999,
            left: -9999,
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

        {/* Loading overlay */}
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
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              color: "#fff",
              fontSize: 14,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  border: "2px solid rgba(255, 255, 255, 0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 12px",
                }}
              />
              Initializing terminal...
            </div>
          </div>
        )}

        {/* CSS for spinner animation */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
);

Terminal.displayName = "Terminal";

export default Terminal;
