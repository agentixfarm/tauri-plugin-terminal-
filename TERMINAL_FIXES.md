# Terminal Plugin Enhancement Plan

## Current Issues

1. **Terminal not auto-expanding to container size** - When the terminal is rendered in a larger container, it stays at its initial size (e.g., 80x24) instead of expanding to fill the available space.

2. **Blurry text on Retina displays** - Canvas rendering needs proper device pixel ratio handling.

3. **Right panel terminals not accepting input** - Focus management issue with multiple terminals.

## Root Cause Analysis

The resize flow is:
1. React component detects container resize via ResizeObserver
2. Calculates new cols/rows based on container size and char size
3. Calls `resizeSession(sessionId, cols, rows)` via Tauri command
4. Rust backend resizes both vt100 parser and PTY
5. Component calls `getScreen()` to fetch new screen state
6. Canvas re-renders with new size

**The issue**: When `getScreen()` is called immediately after `resize()`, the shell program may not have had time to:
1. Receive the SIGWINCH signal
2. Requery the terminal size
3. Redraw its content to fill the new size

## Plan for tauri-plugin-terminal

### Phase 1: Improve Resize Event Flow (Rust Backend)

1. **Add resize event emission** - After resize, emit a `TERMINAL_RESIZED` event with the new size so the frontend knows the resize completed.

2. **Add debounced screen refresh after resize** - The backend should trigger a screen update event after resize to push the new state to the frontend.

3. **Consider SIGWINCH handling** - Ensure the PTY properly sends SIGWINCH to the child process when resized. The `portable-pty` crate should handle this, but verify.

### Phase 2: Improve React Component (guest-js)

1. **Wait for resize completion** - After calling `resize()`, wait for either:
   - A `TERMINAL_RESIZED` event confirming the resize
   - A `SCREEN_UPDATE` event with the new size
   - A timeout with retry

2. **Handle size mismatch** - If the screen returned by `getScreen()` has different dimensions than requested, retry the resize.

3. **DPR handling in canvas** - Already implemented, verify it's working correctly:
   ```typescript
   const dpr = window.devicePixelRatio || 1;
   canvas.width = width * dpr;
   canvas.height = height * dpr;
   canvas.style.width = `${width}px`;
   canvas.style.height = `${height}px`;
   ctx.scale(dpr, dpr);
   ```

### Phase 3: Add Missing Terminal Features

1. **Scrollback support** - The backend has scrollback (10k lines), but the frontend doesn't expose it. Add:
   - Scroll event handling (mouse wheel, touch)
   - Scrollbar component
   - Scrollback line fetching API

2. **Selection and copy** - Basic selection is implemented but needs:
   - Proper text extraction from cells
   - Copy to clipboard integration
   - Selection highlighting during scroll

3. **Link detection** - Detect URLs and file paths in terminal output for click-to-open.

4. **Search** - Add Ctrl+F search within terminal content.

5. **Cursor shapes** - The backend reports cursor shape, but frontend only renders block cursor.

### Phase 4: Performance Optimizations

1. **Incremental rendering** - Only re-render changed cells instead of full screen.

2. **Dirty rect tracking** - Track which regions of the canvas need redrawing.

3. **Double buffering** - Use offscreen canvas for smoother rendering.

4. **Batch screen updates** - Collect multiple updates and render once per frame.

## Immediate Fix: Resize Issue

The quickest fix is to ensure the resize flow works correctly:

### In `terminal.rs`:
- After `parser.set_size(rows, cols)`, clear the previous contents cache to force a full refresh

### In `session.rs`:
- After resize, emit a screen update event to push the new state

### In `hooks.ts` (useTerminal):
- After resize, poll for screen updates until the size matches or timeout

### In `Terminal.tsx`:
- Ensure canvas fills container and re-renders when screen size changes
- Add logging to debug resize flow

## Commands to Test

```bash
# Build the plugin
cd /Users/gshah/work/libs/tauri-plugin-terminal
pnpm build

# Run tests
cargo test

# Check Rust code
cargo clippy

# Run the app
cd /Users/gshah/work/apps/claude-code-studio
pnpm tauri dev
```

## Files to Modify

### Rust Backend
- `rust/src/terminal.rs` - Clear prev_contents on resize
- `rust/src/session.rs` - Emit resize event, force screen update
- `rust/src/events.rs` - Add TerminalResized event type

### JavaScript Frontend
- `guest-js/hooks.ts` - Improve resize handling, wait for confirmation
- `guest-js/events.ts` - Add TERMINAL_RESIZED event constant
- `react/src/Terminal.tsx` - Improve resize detection, add debug logging
