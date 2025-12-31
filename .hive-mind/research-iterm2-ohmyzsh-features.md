# iTerm2 and Oh-My-Zsh Terminal Features Research

**Research Date:** 2025-12-30
**Plugin Version:** tauri-plugin-terminal v0.1.0
**Purpose:** Identify valuable iTerm2 and Oh-My-Zsh features for implementation in Tauri terminal plugin

---

## Executive Summary

This research document identifies key features from iTerm2 and Oh-My-Zsh that would significantly enhance the tauri-plugin-terminal. The features are organized by priority and implementation complexity, with specific recommendations for the Tauri/Rust environment.

**Key Findings:**
1. **Shell Integration (OSC 133)** is the foundation - enables marks, command tracking, and semantic navigation
2. **OSC 8 Hyperlinks** and **OSC 52 Clipboard** are low-hanging fruit with high user value
3. **DECSCUSR cursor shapes** already partially implemented, needs completion
4. **Scrollback management** backend exists, needs frontend exposure
5. **Image protocols** are complex but differentiate modern terminals

---

## 1. iTerm2 Shell Integration Features

### 1.1 FinalTerm Protocol (OSC 133) - HIGH PRIORITY

**What It Is:**
The FinalTerm/OSC 133 protocol marks up shell output with semantic information about prompts, commands, and output zones.

**Escape Sequences:**
```bash
# Sequence definitions
OSC 133 ; A ST          # Start of prompt
OSC 133 ; B ST          # End of prompt, start of command input
OSC 133 ; C ST          # Start of command output
OSC 133 ; D [;code] ST  # End of output, optional exit code
```

**Where ST (String Terminator) = ESC \ or BEL (\x07)**

**Features Enabled:**
- Visual marks at each command prompt (blue/red triangles based on exit code)
- Navigate between commands with keyboard shortcuts (Cmd-Shift-Up/Down)
- Select entire command output with one click
- Alerts when long-running commands finish
- Command history persistence with exit codes
- Automatic scrolling to last command output

**Implementation for Tauri Plugin:**

**Rust Backend (src/terminal.rs):**
```rust
pub struct SemanticZone {
    pub zone_type: ZoneType,
    pub start_row: usize,
    pub end_row: Option<usize>,
    pub exit_code: Option<i32>,
}

pub enum ZoneType {
    Prompt,      // Between A and B
    Input,       // Between B and C
    Output,      // Between C and D
}

impl Terminal {
    fn handle_osc_133(&mut self, params: &str) {
        match params.chars().next() {
            Some('A') => self.mark_prompt_start(),
            Some('B') => self.mark_input_start(),
            Some('C') => self.mark_output_start(),
            Some('D') => self.mark_output_end(parse_exit_code(params)),
            _ => {}
        }
    }
}
```

**Frontend API:**
```typescript
interface SemanticZone {
  type: 'prompt' | 'input' | 'output';
  startRow: number;
  endRow?: number;
  exitCode?: number;
}

// New commands
await terminal.getSemanticZones(sessionId);
await terminal.navigateToZone(sessionId, direction: 'prev' | 'next');
await terminal.selectZoneOutput(sessionId, zoneIndex: number);
```

**Shell Integration Scripts:**
Users would add to their `.zshrc` or `.bashrc`:
```bash
# For Zsh
precmd() {
  echo -ne "\033]133;A\007"
  echo -ne "\033]133;B\007"
}

preexec() {
  echo -ne "\033]133;C\007"
}

# Exit code tracking
PROMPT_COMMAND='echo -ne "\033]133;D;$?\007"'
```

**References:**
- [iTerm2 Shell Integration](https://iterm2.com/documentation-shell-integration.html)
- [OSC 133 Support in tmux](https://github.com/tmux/tmux/issues/3064)
- [WezTerm Shell Integration](https://wezterm.org/shell-integration.html)

---

### 1.2 OSC 8 Hyperlinks - MEDIUM PRIORITY

**What It Is:**
Standard protocol for making terminal text clickable with embedded URLs (like HTML `<a>` tags).

**Escape Sequence:**
```
OSC 8 ; params ; URI ST LinkText OSC 8 ; ; ST
```

**Example:**
```bash
printf '\033]8;;http://example.com\033\\This is a link\033]8;;\033\\\n'
```

**Features:**
- Click URLs to open in browser
- Works with `ls --hyperlink` for file paths
- Supported by modern CLI tools (exa, fd, bat)
- Ctrl+Click or Cmd+Click to activate

**Implementation:**

**Rust Backend:**
```rust
pub struct Hyperlink {
    pub url: String,
    pub start_col: usize,
    pub end_col: usize,
    pub row: usize,
}

impl Terminal {
    fn handle_osc_8(&mut self, params: &str, url: &str) {
        if url.is_empty() {
            self.current_hyperlink = None;
        } else {
            self.current_hyperlink = Some(url.to_string());
        }
    }
}
```

**Frontend:**
```typescript
interface CellWithLink extends Cell {
  hyperlink?: string;
}

// In Terminal.tsx
const handleClick = (row: number, col: number, event: MouseEvent) => {
  const cell = screen.cells[row][col];
  if (cell.hyperlink && (event.metaKey || event.ctrlKey)) {
    window.open(cell.hyperlink, '_blank');
  }
};
```

**Limitations:**
- URI must be 2083 bytes or less (browser limit)
- Must only contain ASCII 32-126, otherwise URI-encode

**References:**
- [Hyperlinks in Terminal Emulators Gist](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
- [OSC 8 Adoption Tracker](https://github.com/Alhadis/OSC8-Adoption)

---

### 1.3 OSC 52 Clipboard Integration - HIGH PRIORITY

**What It Is:**
Allows terminal applications to read/write system clipboard, works over SSH!

**Escape Sequences:**
```bash
# Write to clipboard
printf '\033]52;c;%s\007' "$(echo -n 'text' | base64)"

# Read from clipboard
printf '\033]52;c;?\007'
# Terminal responds with: OSC 52;c;base64data ST
```

**Parameters:**
- `c` = clipboard (universal)
- `p` = primary selection (Linux X11 only)

**Features:**
- Copy from remote SSH sessions to local clipboard
- Vim/Neovim clipboard integration over SSH
- Tmux clipboard support
- Maximum 74,994 bytes of text (100,000 byte sequence limit)

**Implementation:**

**Rust Backend:**
```rust
use clipboard::{ClipboardProvider, ClipboardContext};

impl Terminal {
    fn handle_osc_52(&mut self, clipboard_type: char, data: &str) {
        if data == "?" {
            // Query clipboard
            if let Ok(mut ctx) = ClipboardContext::new() {
                if let Ok(content) = ctx.get_contents() {
                    let encoded = base64::encode(&content);
                    self.write_to_pty(&format!("\x1b]52;{};{}\x07", clipboard_type, encoded));
                }
            }
        } else {
            // Set clipboard
            if let Ok(decoded) = base64::decode(data) {
                if let Ok(text) = String::from_utf8(decoded) {
                    if let Ok(mut ctx) = ClipboardContext::new() {
                        let _ = ctx.set_contents(text);
                    }
                }
            }
        }
    }
}
```

**Security Consideration:**
- Some terminals require user confirmation for clipboard writes
- Consider adding a permission setting: `allow_clipboard_access: bool`

**References:**
- [OSC 52 Overview](https://github.com/theimpostor/osc)
- [Copying with OSC 52 in tmux/Vim](https://sunaku.github.io/tmux-yank-osc52.html)

---

### 1.4 DECSCUSR Cursor Shapes - LOW PRIORITY (Partially Implemented)

**What It Is:**
Allows applications to change cursor shape/blink dynamically.

**Escape Sequence:**
```
CSI Ps SP q
```

**Values:**
```
0 or 1 = Blinking block (default)
2      = Steady block
3      = Blinking underline
4      = Steady underline
5      = Blinking bar (I-beam)
6      = Steady bar (I-beam)
```

**Current Status:**
- ✅ Backend supports cursor shapes (block, underline, bar)
- ✅ Frontend renders different shapes
- ❌ Backend doesn't parse DECSCUSR sequences
- ❌ No cursor blinking support

**Implementation Needed:**

**Rust Backend:**
```rust
impl Terminal {
    fn handle_decscusr(&mut self, param: u16) {
        let (shape, blink) = match param {
            0 | 1 => (CursorShape::Block, true),
            2 => (CursorShape::Block, false),
            3 => (CursorShape::Underline, true),
            4 => (CursorShape::Underline, false),
            5 => (CursorShape::Bar, true),
            6 => (CursorShape::Bar, false),
            _ => return,
        };
        self.cursor_shape = shape;
        self.cursor_blink = blink;
    }
}
```

**Frontend:**
```typescript
// In Terminal.tsx render loop
if (screen.cursor.blink) {
  const blinkInterval = 500; // ms
  const shouldShow = Math.floor(Date.now() / blinkInterval) % 2 === 0;
  if (!shouldShow) return; // Skip cursor rendering
}
```

**Use Case:**
Vim/Neovim users expect different cursor shapes for different modes:
- Block: Normal mode
- Underline: Replace mode
- Bar: Insert mode

**References:**
- [DECSCUSR Implementation in Konsole](https://phabricator.kde.org/D8464)
- [Windows Terminal Cursor Sequences](https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences)

---

### 1.5 iTerm2 Inline Images Protocol - LOW PRIORITY (Complex)

**What It Is:**
Display images inline in the terminal (like `imgcat` command).

**Escape Sequence:**
```
OSC 1337 ; File = [arguments] : base64data ST
```

**Arguments:**
- `inline=1` - Display inline vs download
- `width=N` or `width=Npx` or `width=N%`
- `height=N` or `height=Npx` or `height=N%`
- `preserveAspectRatio=0|1`
- `name=base64filename`

**Example:**
```bash
printf '\033]1337;File=inline=1:'
base64 < image.png
printf '\a\n'
```

**Alternative: Sixel Graphics**
Sixel is a more widely supported standard for terminal graphics.

**Implementation Complexity:**
- Requires image decoding (PNG, JPEG, GIF, etc.)
- Memory management for image data
- Canvas layer for image rendering
- Scrollback with images is memory-intensive

**Recommendation:**
- **Defer to v0.3.0** - Image support is complex and less critical than shell integration
- When implementing, consider Sixel over iTerm2 protocol for broader compatibility

**References:**
- [iTerm2 Images Documentation](https://iterm2.com/documentation-images.html)
- [Kitty Graphics Protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/)

---

### 1.6 Split Panes Focus Management - MEDIUM PRIORITY

**What It Is:**
iTerm2's approach to managing multiple terminal sessions in split views.

**Key Features:**
- Cmd+D: Split horizontally
- Cmd+Shift+D: Split vertically
- Cmd+Opt+Arrow: Navigate between panes
- Cmd+Shift+Enter: Maximize/restore pane
- Visual dimming of unfocused panes
- Focus follows mouse (optional)

**Implementation for Tauri:**

This is more of a **frontend/app-level feature** than plugin-level, but the plugin should support it:

**Plugin Requirements:**
```typescript
// Terminal.tsx needs focus prop
interface TerminalProps {
  focused?: boolean;  // ✅ Already exists
  onFocus?: () => void;  // ✅ Already exists
  onBlur?: () => void;   // ✅ Already exists
}

// Visual dimming when unfocused
<div style={{
  opacity: focused ? 1.0 : 0.7,  // Dim unfocused panes
}}>
```

**App-Level Implementation:**
```typescript
// Split pane management in the app
interface PaneLayout {
  id: string;
  sessionId: string;
  direction: 'horizontal' | 'vertical';
  children?: PaneLayout[];
  size?: number; // percentage
}

// Focus management
const [focusedPaneId, setFocusedPaneId] = useState<string>();
```

**References:**
- [iTerm2 Split Panes](https://iterm2.com/documentation-one-page.html)
- [iTerm2 Focus Management Issues](https://gitlab.com/gnachman/iterm2/-/issues/9668)

---

## 2. Oh-My-Zsh Integration Requirements

### 2.1 Terminal Requirements for Oh-My-Zsh

**What Oh-My-Zsh Needs:**

**1. 256 Color Support** ✅
- Already implemented via vt100 parser
- Themes use colors 0-255

**2. Unicode Support** ✅
- Already supported
- Needed for Powerline symbols

**3. Font Requirements** ⚠️
Many Oh-My-Zsh themes require special fonts:

**Powerline Fonts:**
- Extra glyphs for status line separators
- Symbols: ,  ,  , , ,

**Nerd Fonts:**
- Superset of Powerline fonts
- Includes Font Awesome, Material Design Icons, etc.
- 3,600+ glyphs
- Recommended fonts:
  - FiraCode Nerd Font
  - JetBrainsMono Nerd Font
  - Hack Nerd Font
  - CascadiaCode Nerd Font

**Plugin Requirement:**
- Document font requirements in README
- Provide font detection/warning in terminal component

```typescript
// Font detection utility
function detectNerdFontSupport(fontFamily: string): boolean {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `14px ${fontFamily}`;
  const width = ctx.measureText('').width;
  return width > 0; // If glyph renders, font is installed
}
```

**4. Escape Sequence Support** ⚠️

Oh-My-Zsh themes rely on these sequences:

| Feature | Sequence | Status |
|---------|----------|--------|
| 256 colors | `ESC[38;5;Nm` | ✅ Supported |
| RGB colors | `ESC[38;2;R;G;Bm` | ✅ Supported |
| Bold | `ESC[1m` | ✅ Supported |
| Italic | `ESC[3m` | ✅ Supported |
| Cursor positioning | `ESC[H`, `ESC[row;colH` | ✅ Supported |
| Title setting | `OSC 0;title ST` | ✅ Supported |
| Shell integration | `OSC 133` | ❌ **NEEDED** |

**References:**
- [Oh-My-Zsh Official Site](https://ohmyz.sh/)
- [Oh-My-Zsh Themes Wiki](https://github.com/ohmyzsh/ohmyzsh/wiki/Themes)
- [Nerd Fonts](https://www.nerdfonts.com/)

---

### 2.2 Prompt Theming Support

**Powerlevel10k Integration** (Most popular Oh-My-Zsh theme)

**Requirements:**
1. **256-color support** ✅
2. **Unicode rendering** ✅
3. **Prompt re-rendering**:
   - Powerlevel10k uses ANSI sequences to overwrite parts of the prompt
   - Requires proper cursor positioning
4. **Async prompt updates**:
   - Git status loads asynchronously
   - Uses `PROMPT_COMMAND` or `precmd` hooks

**Known Issues to Avoid:**
- Some terminals don't handle prompt wrapping correctly on SIGWINCH
- Multi-line prompts can have cursor positioning issues

**Testing Approach:**
```bash
# Install Powerlevel10k
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ~/powerlevel10k
echo 'source ~/powerlevel10k/powerlevel10k.zsh-theme' >> ~/.zshrc

# Run configuration wizard
p10k configure
```

**References:**
- [Powerlevel10k](https://github.com/romkatv/powerlevel10k)

---

### 2.3 Git Integration

Oh-My-Zsh shows Git status in the prompt. The terminal doesn't need to do anything special - this is handled by the shell - but **performance matters**:

**Git Prompts Are Slow:**
- Running `git status` for every prompt can lag
- Oh-My-Zsh uses async functions to avoid blocking

**Terminal Optimization:**
- Ensure input latency is < 16ms
- Don't block on screen refreshes
- Use dirty rectangle tracking for minimal redraws

---

## 3. Terminal Escape Sequences Reference

### 3.1 Implemented Sequences ✅

**Current vt100 Parser Support:**
- CSI sequences (colors, cursor movement, etc.)
- SGR (Select Graphic Rendition) - bold, italic, colors
- ED (Erase Display)
- EL (Erase Line)
- CUP (Cursor Position)
- Basic OSC sequences (title)

### 3.2 Sequences to Add

| Priority | Sequence | Description | Use Case |
|----------|----------|-------------|----------|
| HIGH | OSC 133 | Shell integration | Command tracking, marks |
| HIGH | OSC 52 | Clipboard | Copy/paste over SSH |
| MEDIUM | OSC 8 | Hyperlinks | Clickable URLs/files |
| MEDIUM | DECSCUSR | Cursor shape | Vim mode indicators |
| LOW | OSC 7 | Current directory | Shell integration |
| LOW | OSC 9;9 | ConEmu integration | Windows compatibility |

**Implementation Guide:**

```rust
// In terminal.rs
fn parse_osc(&mut self, sequence: &str) {
    let parts: Vec<&str> = sequence.splitn(2, ';').collect();

    match parts[0] {
        "0" | "2" => self.set_title(parts.get(1).unwrap_or(&"")),
        "7" => self.set_current_directory(parts.get(1).unwrap_or(&"")),
        "8" => self.handle_hyperlink(parts.get(1).unwrap_or(&"")),
        "52" => self.handle_clipboard(parts.get(1).unwrap_or(&"")),
        "133" => self.handle_shell_integration(parts.get(1).unwrap_or(&"")),
        "1337" => self.handle_iterm2_proprietary(parts.get(1).unwrap_or(&"")),
        _ => {} // Ignore unknown sequences
    }
}
```

---

## 4. Best Practices for Terminal Implementation

### 4.1 Resize Event Handling

**The Problem:**
When a terminal is resized, multiple systems need to coordinate:
1. Frontend detects container resize
2. Calculate new cols/rows
3. Send resize to backend
4. Backend resizes vt100 parser
5. Backend resizes PTY (sends SIGWINCH to shell)
6. Shell redraws content
7. Frontend fetches new screen state

**Best Practices from Research:**

**1. Use Flag-Based Signal Handling (POSIX Standard)**
```rust
// DON'T call resize functions directly in signal handler
// DO set a flag and handle in main loop

static RESIZE_FLAG: AtomicBool = AtomicBool::new(false);

fn sigwinch_handler(_: i32) {
    RESIZE_FLAG.store(true, Ordering::Relaxed);
}

fn main_loop() {
    if RESIZE_FLAG.swap(false, Ordering::Relaxed) {
        let size = get_terminal_size(); // ioctl(TIOCGWINSZ)
        handle_resize(size);
    }
}
```

**2. Debounce Resize Events**
```typescript
// In Terminal.tsx - already implemented ✅
const handleResize = useCallback(() => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(actualResize, 100); // 100ms debounce
}, []);
```

**3. Rate Limiting (30 FPS max)**
```rust
// For rapid resize events (user dragging window)
const RESIZE_MIN_INTERVAL: Duration = Duration::from_millis(33); // ~30 FPS

if last_resize.elapsed() < RESIZE_MIN_INTERVAL {
    return; // Skip this resize
}
```

**4. Resize Confirmation Flow**
```typescript
// Current implementation has this ✅
await resize(cols, rows);
await new Promise(resolve => setTimeout(resolve, 50)); // Let backend process
await refresh(); // Get updated screen
```

**5. Handle Environment Variables**
```bash
# If LINES/COLUMNS are set, they override actual size
# Backend should check these
unset LINES COLUMNS  # Recommended in shell integration scripts
```

**References:**
- [Playing with SIGWINCH](http://www.rkoucha.fr/tech_corner/sigwinch.html)
- [ncurses resizeterm](https://man7.org/linux/man-pages/man3/resizeterm.3x.html)

---

### 4.2 Scrollback Management

**Current Status:**
- ✅ Backend has 10,000 line scrollback buffer
- ❌ Frontend doesn't expose scrollback access
- ❌ No scroll events handled

**Best Practices:**

**1. Separate Viewport from Scrollback**
```rust
pub struct TerminalBuffer {
    scrollback: VecDeque<Row>,     // Historical lines
    viewport: Vec<Row>,             // Visible screen
    scrollback_position: usize,     // User's scroll offset
}
```

**2. Efficient Scrollback Fetching**
```typescript
// Don't send entire scrollback, fetch on-demand
interface ScrollbackRequest {
  sessionId: string;
  startLine: number;  // Negative = lines above viewport
  count: number;
}

await terminal.getScrollback(sessionId, -100, 50); // Get 50 lines starting 100 lines up
```

**3. Alternate Screen Buffer Handling**
```rust
// Apps like vim use alternate screen
// DON'T clear scrollback when entering alt screen
// DON'T save alt screen to scrollback

if entering_alt_screen {
    self.saved_viewport = self.viewport.clone();
    self.clear_viewport(); // But keep scrollback!
}
```

**4. Memory Management**
```rust
const MAX_SCROLLBACK: usize = 10_000;

if self.scrollback.len() > MAX_SCROLLBACK {
    self.scrollback.pop_front(); // FIFO
}
```

**5. Scroll Position Tracking**
```typescript
// In Terminal.tsx
const [scrollOffset, setScrollOffset] = useState(0);

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const delta = Math.sign(e.deltaY) * 3; // 3 lines per wheel click
  setScrollOffset(prev => Math.max(0, prev + delta));
};

useEffect(() => {
  if (scrollOffset > 0) {
    // Fetch scrollback lines
    fetchScrollback(-scrollOffset, screen.size.rows);
  }
}, [scrollOffset]);
```

**References:**
- [WezTerm Scrollback Discussion](https://github.com/wezterm/wezterm/discussions/3356)
- [Scrollback Buffer Configuration](https://wezterm.org/scrollback.html)

---

### 4.3 Selection Modes

**Types of Selection:**

**1. Character/Word/Line Selection (Standard)**
```typescript
// Already partially implemented ✅
const handleMouseDown = (e: MouseEvent) => {
  if (e.detail === 1) {
    selectionMode = 'char';
  } else if (e.detail === 2) {
    selectionMode = 'word';
    selectWord(row, col);
  } else if (e.detail === 3) {
    selectionMode = 'line';
    selectLine(row);
  }
};
```

**2. Rectangular (Block) Selection**
```typescript
// NOT implemented - should add
const handleMouseDown = (e: MouseEvent) => {
  if (e.altKey) {
    selectionMode = 'block';
    // Select rectangle instead of flowing text
  }
};

function getBlockSelection(start: Pos, end: Pos): string {
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  let text = '';
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      text += screen.cells[row][col].char;
    }
    text += '\n';
  }
  return text;
}
```

**3. Semantic Selection (Smart Selection)**
```typescript
// Detect URLs, file paths, etc.
const patterns = {
  url: /https?:\/\/[^\s]+/,
  filePath: /(?:~|\.{1,2})?\/[\w\/-]+/,
  email: /[\w\.-]+@[\w\.-]+\.\w+/,
};

function selectSemantic(row: number, col: number) {
  const line = getLineText(row);
  for (const [type, pattern] of Object.entries(patterns)) {
    const match = line.match(pattern);
    if (match && col >= match.index && col < match.index + match[0].length) {
      selectRange(row, match.index, row, match.index + match[0].length);
      return;
    }
  }
}
```

**4. Selection During Scrollback**
```typescript
// Selection coordinates need to be relative to scrollback, not viewport
interface Selection {
  start: { row: number; col: number };  // Absolute row in buffer
  end: { row: number; col: number };
  scrollbackOffset: number; // Where viewport was when selection started
}
```

**References:**
- [WezTerm Selection Modes](https://wezterm.org/config/lua/keyassignment/CopyMode/SetSelectionMode.html)
- [Windows Terminal Selection](https://learn.microsoft.com/en-us/windows/terminal/selection)

---

### 4.4 URL/Link Detection Patterns

**Approach: Don't Use Complex Regex**

Based on research, perfect URL regex is impossible. Instead:

**1. Simple URL Detection**
```typescript
const URL_PATTERNS = [
  // Must start with protocol
  /\b(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g,
  /\b(ftp:\/\/[^\s<>"{}|\\^`\[\]]+)/g,

  // File paths (Unix)
  /\b(~?\/[\w\d\.\-_\/]+)/g,

  // File paths (Windows)
  /\b([A-Z]:\\[\w\d\.\-_\\]+)/g,
];

// Detect end of URL by checking next character
function detectURLBoundary(text: string, matchEnd: number): number {
  const nextChar = text[matchEnd];
  const trailingPunctuation = ['.', ',', '!', '?', ';', ':', ')'];

  if (trailingPunctuation.includes(nextChar)) {
    // Check if next is whitespace or end
    if (matchEnd + 1 >= text.length || /\s/.test(text[matchEnd + 1])) {
      return matchEnd - 1; // Punctuation not part of URL
    }
  }
  return matchEnd;
}
```

**2. File Path Detection**
```typescript
// Detect file:line:col patterns (common in compiler output)
const FILE_LINE_COL = /([a-zA-Z0-9\.\-_\/\\]+):(\d+)(?::(\d+))?/g;

// Example: "src/main.rs:42:15"
// Should be clickable, opens editor at that line
```

**3. Combine with OSC 8**
```typescript
// Prefer OSC 8 hyperlinks over pattern detection
// Only use pattern detection as fallback

function getClickableElements(row: number): ClickableElement[] {
  const elements: ClickableElement[] = [];

  // 1. Check for OSC 8 hyperlinks in cells
  for (let col = 0; col < screen.size.cols; col++) {
    const cell = screen.cells[row][col];
    if (cell.hyperlink) {
      elements.push({
        type: 'hyperlink',
        url: cell.hyperlink,
        startCol: col,
        endCol: col, // Extend until link changes
      });
    }
  }

  // 2. If no OSC 8 links, use pattern detection
  if (elements.length === 0) {
    const lineText = getRowText(row);
    for (const pattern of URL_PATTERNS) {
      const matches = lineText.matchAll(pattern);
      for (const match of matches) {
        elements.push({
          type: 'pattern',
          url: match[0],
          startCol: match.index,
          endCol: match.index + match[0].length,
        });
      }
    }
  }

  return elements;
}
```

**References:**
- [URL Detection Issues (Microsoft Terminal)](https://github.com/microsoft/terminal/issues/8321)
- [Gruber's URL Regex](https://gist.github.com/gruber/249502)

---

### 4.5 Performance Optimization Techniques

Based on research of modern terminal emulators (VS Code, Ghostty, WezTerm):

**Current Status:**
- ✅ Canvas rendering implemented
- ✅ Device pixel ratio handling
- ❌ No texture atlas
- ❌ Full screen redraws every time
- ❌ No dirty rectangle tracking

**Recommended Optimizations:**

**1. Texture Atlas for ASCII Characters** 🔥
```typescript
// Pre-render common characters to ImageBitmap
class GlyphAtlas {
  private canvas: OffscreenCanvas;
  private glyphs: Map<string, { x: number; y: number }>;

  constructor(fontSize: number, fontFamily: string) {
    // Create 16x16 grid of common ASCII chars
    this.canvas = new OffscreenCanvas(16 * fontSize, 16 * fontSize);
    const ctx = this.canvas.getContext('2d')!;

    for (let i = 32; i < 127; i++) {
      const char = String.fromCharCode(i);
      const x = ((i - 32) % 16) * fontSize;
      const y = Math.floor((i - 32) / 16) * fontSize;

      ctx.fillText(char, x, y);
      this.glyphs.set(char, { x, y });
    }
  }

  drawChar(ctx: CanvasRenderingContext2D, char: string, x: number, y: number) {
    const glyph = this.glyphs.get(char);
    if (glyph) {
      // Fast: copy from pre-rendered atlas
      ctx.drawImage(this.canvas, glyph.x, glyph.y, charWidth, charHeight, x, y, charWidth, charHeight);
    } else {
      // Slow: render on-demand (for Unicode, emojis)
      ctx.fillText(char, x, y);
    }
  }
}

// Performance: 900% faster for ASCII-heavy output
```

**2. Dirty Rectangle Tracking**
```typescript
interface DirtyRegion {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

class TerminalRenderer {
  private dirtyRegions: DirtyRegion[] = [];

  markDirty(row: number, col: number) {
    // Merge adjacent dirty regions
    this.dirtyRegions.push({ startRow: row, endRow: row, startCol: col, endCol: col });
  }

  render() {
    // Only redraw dirty regions
    for (const region of this.dirtyRegions) {
      this.renderRegion(region);
    }
    this.dirtyRegions = [];
  }
}
```

**3. Render Layers (Multiple Canvases)**
```typescript
// Separate static and dynamic content
<div style={{ position: 'relative' }}>
  <canvas ref={textLayerRef} />      {/* Layer 0: Static text */}
  <canvas ref={cursorLayerRef} />    {/* Layer 1: Blinking cursor */}
  <canvas ref={selectionLayerRef} /> {/* Layer 2: Selection highlight */}
</div>

// Only redraw cursor layer 30 times/sec
// Only redraw text layer on screen updates
```

**4. OffscreenCanvas for Background Rendering**
```typescript
const offscreen = new OffscreenCanvas(width, height);
const ctx = offscreen.getContext('2d')!;

// Render to offscreen canvas
renderToCanvas(ctx, screen);

// Copy to visible canvas (fast)
visibleCtx.drawImage(offscreen, 0, 0);
```

**5. RequestAnimationFrame Batching**
```typescript
let renderScheduled = false;

function scheduleRender() {
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(() => {
      render();
      renderScheduled = false;
    });
  }
}

// Batch multiple screen updates into single frame
onScreenUpdate(() => scheduleRender());
```

**6. WebGL Rendering (Advanced)**
```typescript
// For future: WebGL renderer can be 900% faster
// Use typed arrays and GPU shaders
// Example: xterm.js WebGL addon
```

**References:**
- [VS Code Terminal Performance](https://code.visualstudio.com/blogs/2017/10/03/terminal-renderer)
- [How VS Code Terminal is So Fast](https://gist.github.com/weihanglo/8b5efd2dbc4302d123af089e510f5326)
- [Ghostty Multi-Renderer Architecture](https://github.com/ghostty-org/ghostty)

---

## 5. Bracketed Paste Mode

**What It Is:**
Security feature that distinguishes typed input from pasted text.

**Escape Sequences:**
```bash
# Enable
printf '\e[?2004h'

# Disable
printf '\e[?2004l'

# Pasted text is wrapped
\e[200~PASTED_TEXT\e[201~
```

**Current Status:**
- ✅ Frontend sends bracketed paste (lines 401-403 in Terminal.tsx)
- ❌ Backend doesn't handle enable/disable sequences
- ❌ No security confirmation

**Why It Matters:**
- Prevents accidental command execution from pasted text
- Allows shells to handle multi-line pastes correctly
- Security vulnerability if not implemented correctly

**Implementation:**
```rust
// In terminal.rs
impl Terminal {
    fn handle_decset(&mut self, params: &[u16]) {
        for &param in params {
            match param {
                2004 => self.bracketed_paste_mode = true,
                _ => {}
            }
        }
    }

    fn handle_decrst(&mut self, params: &[u16]) {
        for &param in params {
            match param {
                2004 => self.bracketed_paste_mode = false,
                _ => {}
            }
        }
    }
}
```

**References:**
- [Bracketed Paste Mode](https://cirw.in/blog/bracketed-paste)
- [Bracketed Paste Security](https://jdhao.github.io/2021/02/01/bracketed_paste_mode/)

---

## 6. Implementation Roadmap

### Phase 1: Shell Integration (v0.2.0) - HIGH IMPACT
**Target: 2-3 weeks**

1. **OSC 133 Support**
   - [ ] Parse OSC 133 A/B/C/D sequences
   - [ ] Track semantic zones in terminal state
   - [ ] Add zone navigation API
   - [ ] Visual marks in frontend (optional CSS class on rows)

2. **OSC 52 Clipboard**
   - [ ] Parse OSC 52 sequences
   - [ ] Integrate with system clipboard (clipboard crate)
   - [ ] Add permission setting
   - [ ] Test over SSH

3. **DECSCUSR Cursor Shapes**
   - [ ] Parse CSI Ps SP q sequences
   - [ ] Add cursor blink state
   - [ ] Implement blink animation in frontend

4. **Documentation**
   - [ ] Shell integration setup guide (zsh, bash, fish)
   - [ ] Example `.zshrc` snippets
   - [ ] Troubleshooting guide

**Success Metrics:**
- Commands have visual marks
- Exit codes tracked
- Copy from remote sessions works
- Vim cursor shapes work

---

### Phase 2: Links and Selection (v0.2.5) - MEDIUM IMPACT
**Target: 1-2 weeks**

1. **OSC 8 Hyperlinks**
   - [ ] Parse OSC 8 sequences
   - [ ] Store URLs in cell metadata
   - [ ] Click handling in frontend
   - [ ] Ctrl/Cmd+Click to open

2. **Smart URL Detection**
   - [ ] URL pattern matching (fallback for no OSC 8)
   - [ ] File path detection
   - [ ] Hover indicator

3. **Improved Selection**
   - [ ] Rectangular selection (Alt+drag)
   - [ ] Semantic selection (double-click URL)
   - [ ] Selection during scrollback

4. **Scrollback Frontend**
   - [ ] Mouse wheel scroll handling
   - [ ] Scrollback fetch API
   - [ ] Scroll position indicator

**Success Metrics:**
- URLs are clickable
- File paths open in editor
- Rectangular selection works
- Can scroll back 10,000 lines

---

### Phase 3: Advanced Features (v0.3.0) - NICE TO HAVE
**Target: 3-4 weeks**

1. **Search in Scrollback**
   - [ ] Text search API
   - [ ] Regex search support
   - [ ] Highlight matches
   - [ ] Navigate between matches

2. **Ligature Support**
   - [ ] Detect ligature fonts
   - [ ] Render ligatures correctly
   - [ ] Performance optimization

3. **Image Protocol** (Optional)
   - [ ] Choose Sixel vs iTerm2
   - [ ] Image decoding
   - [ ] Canvas overlay for images
   - [ ] Memory management

4. **Performance Optimizations**
   - [ ] Texture atlas for ASCII
   - [ ] Dirty rectangle tracking
   - [ ] Render layers
   - [ ] OffscreenCanvas rendering

**Success Metrics:**
- Search finds text in 10k lines < 100ms
- Ligatures render correctly
- Images display inline (if implemented)
- Rendering maintains 60 FPS under load

---

## 7. Testing Strategy

### 7.1 Shell Integration Testing

**Test Cases:**
```bash
# Create test script
cat > test_shell_integration.sh << 'EOF'
#!/bin/bash

echo "Test 1: Exit code tracking"
true
echo "Should have exit code 0"

false
echo "Should have exit code 1"

echo "Test 2: Multi-line command"
for i in {1..5}; do
  echo "Line $i"
done

echo "Test 3: Long output"
seq 1 100

echo "Test 4: Command with special chars"
echo "Hello | grep World || echo Fallback"
EOF

chmod +x test_shell_integration.sh
./test_shell_integration.sh
```

**Verification:**
- Check semantic zones are created
- Exit codes are captured
- Can navigate between commands
- Can select command output

---

### 7.2 Clipboard Testing

```bash
# Test OSC 52
printf '\033]52;c;%s\007' "$(echo -n 'Hello from terminal' | base64)"

# Verify clipboard contains "Hello from terminal"
# Test query
printf '\033]52;c;?\007'
# Should receive response with clipboard contents
```

---

### 7.3 URL Detection Testing

```bash
cat << 'EOF'
Test URLs:
https://example.com/path?query=value
http://github.com/user/repo/issues/123
ftp://ftp.example.com/file.txt

File paths:
/usr/local/bin/myapp
~/Documents/file.txt
./relative/path.txt

File:line:col:
src/main.rs:42:15
lib/utils.ts:108:7
EOF
```

**Verification:**
- Hover shows underline
- Ctrl/Cmd+Click opens URL
- File paths are detected

---

### 7.4 Performance Testing

```bash
# Stress test: high-speed output
while true; do
  echo "Line $RANDOM"
done

# Measure FPS while scrolling
# Should maintain ~60 FPS

# Large output
seq 1 100000

# Scroll through - should be smooth
```

---

## 8. Compatibility Matrix

### 8.1 Tested Terminal Applications

| App | Shell Integration | Hyperlinks | Clipboard | Cursor Shapes | Images |
|-----|------------------|------------|-----------|---------------|--------|
| iTerm2 | ✅ OSC 133 | ✅ OSC 8 | ✅ OSC 52 | ✅ DECSCUSR | ✅ Proprietary |
| WezTerm | ✅ OSC 133 | ✅ OSC 8 | ✅ OSC 52 | ✅ DECSCUSR | ✅ Proprietary |
| Kitty | ✅ OSC 133 | ✅ OSC 8 | ✅ OSC 52 | ✅ DECSCUSR | ✅ Graphics Protocol |
| Ghostty | ✅ OSC 133 | ✅ OSC 8 | ✅ OSC 52 | ✅ DECSCUSR | ✅ Multiple |
| VS Code | ✅ OSC 133 | ✅ OSC 8 | ⚠️ Limited | ✅ DECSCUSR | ❌ |
| Windows Terminal | ✅ OSC 133 | ✅ OSC 8 | ❌ | ✅ DECSCUSR | ❌ |
| Alacritty | ❌ | ✅ OSC 8 | ✅ OSC 52 | ✅ DECSCUSR | ❌ |

**Target for tauri-plugin-terminal:**
- Match WezTerm feature set (highly compatible)
- Prioritize features with broad support (OSC 133, 8, 52, DECSCUSR)
- Defer proprietary features (images) to later versions

---

### 8.2 Shell Compatibility

| Shell | OSC 133 Support | Setup Required | Notes |
|-------|----------------|----------------|-------|
| Zsh | ✅ | Manual script | Needs precmd/preexec hooks |
| Bash | ✅ | Manual script | Needs PROMPT_COMMAND |
| Fish | ✅ | Built-in (3.4+) | fish_prompt integration |
| Nushell | ✅ | Built-in | Native support |
| PowerShell | ⚠️ | Complex | Windows-specific |

**Recommendation:**
- Provide shell integration scripts for Zsh and Bash
- Document Fish built-in support
- Test primarily on Zsh (Oh-My-Zsh users)

---

## 9. Documentation Requirements

### 9.1 User Documentation

**README Updates:**
```markdown
## Shell Integration

Enable shell integration for advanced features:

### Zsh
Add to ~/.zshrc:
```zsh
# Shell integration
precmd() {
  echo -ne "\033]133;A\007"
}

preexec() {
  echo -ne "\033]133;C\007"
}

PROMPT_COMMAND='echo -ne "\033]133;D;$?\007"'
```

### Features Enabled:
- Command marks (navigate with Cmd-Up/Down)
- Exit code tracking
- Select command output
- Alerts on command completion
```

---

### 9.2 API Documentation

**New Commands:**
```typescript
/**
 * Get semantic zones (prompts, commands, output) for a session.
 * Requires shell integration to be enabled.
 */
async function getSemanticZones(sessionId: string): Promise<SemanticZone[]>;

/**
 * Navigate to the previous or next semantic zone.
 */
async function navigateToZone(sessionId: string, direction: 'prev' | 'next'): Promise<void>;

/**
 * Get scrollback lines.
 * @param startLine - Negative number = lines before viewport
 * @param count - Number of lines to fetch
 */
async function getScrollback(sessionId: string, startLine: number, count: number): Promise<Row[]>;

/**
 * Configure clipboard integration.
 */
async function setClipboardPermission(sessionId: string, allowed: boolean): Promise<void>;
```

---

### 9.3 Examples

**Example: Command Tracking**
```typescript
import { Terminal, useTerminalSession } from '@anthropic/tauri-plugin-terminal/react';
import { getSemanticZones } from '@anthropic/tauri-plugin-terminal';

function CommandHistory({ sessionId }) {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const zones = await getSemanticZones(sessionId);
      setZones(zones.filter(z => z.type === 'output'));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId]);

  return (
    <div>
      <h3>Recent Commands</h3>
      {zones.map((zone, i) => (
        <div key={i} style={{ color: zone.exitCode === 0 ? 'green' : 'red' }}>
          Command #{i + 1} - Exit code: {zone.exitCode}
        </div>
      ))}
    </div>
  );
}
```

---

## 10. Security Considerations

### 10.1 Clipboard Access

**Risk:** Malicious websites/apps could read clipboard via OSC 52.

**Mitigation:**
```rust
pub struct SessionConfig {
    pub allow_clipboard_write: bool,  // Default: true
    pub allow_clipboard_read: bool,   // Default: false (security)
}

impl Terminal {
    fn handle_osc_52(&mut self, clipboard_type: char, data: &str) {
        if data == "?" && !self.config.allow_clipboard_read {
            // Ignore clipboard read request
            return;
        }

        if data != "?" && !self.config.allow_clipboard_write {
            // Ignore clipboard write request
            return;
        }

        // ... normal handling
    }
}
```

**User Permission:**
```typescript
// Require explicit user permission for clipboard reads
const allowed = await ask('Allow terminal to read clipboard?', {
  title: 'Clipboard Permission',
  type: 'warning',
});

if (allowed) {
  await terminal.setClipboardPermission(sessionId, true);
}
```

---

### 10.2 URL Handling

**Risk:** Malicious URLs in terminal output.

**Mitigation:**
```typescript
function sanitizeURL(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Block dangerous protocols
    const blocked = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (blocked.some(p => parsed.protocol.startsWith(p))) {
      return null;
    }

    return parsed.href;
  } catch {
    return null; // Invalid URL
  }
}

function handleLinkClick(url: string) {
  const safe = sanitizeURL(url);
  if (safe) {
    window.open(safe, '_blank');
  }
}
```

---

### 10.3 Escape Sequence Injection

**Risk:** Malicious escape sequences in untrusted input.

**Current Protection:**
- ✅ vt100 parser validates all sequences
- ✅ Unknown sequences are ignored

**Additional Hardening:**
```rust
// Limit OSC sequence length (prevent buffer overflow)
const MAX_OSC_LENGTH: usize = 100_000; // Same as OSC 52 limit

if sequence.len() > MAX_OSC_LENGTH {
    return; // Ignore oversized sequences
}
```

---

## 11. Known Limitations and Future Work

### 11.1 Current Limitations

1. **No True Color Support in Themes**
   - vt100 crate supports it, but theme system uses indexed colors only
   - Fix: Add RGB color support to Theme struct

2. **No Scrollback in Alternate Screen**
   - Apps like vim/less use alternate screen
   - Scrollback is cleared when entering alt screen
   - Fix: Save main screen scrollback separately

3. **No Sixel Graphics**
   - No image protocol support
   - Fix: Add in v0.3.0

4. **Limited Font Ligature Support**
   - Canvas rendering can't handle ligatures well
   - Fix: Requires complex text layout (HarfBuzz)

5. **No Multi-Column Character Support**
   - CJK characters (Chinese, Japanese, Korean) may render incorrectly
   - Fix: Track cell width in vt100 parser

---

### 11.2 Future Research

**Areas to Explore:**

1. **Sixel vs Kitty Graphics Protocol**
   - Which is better for Tauri apps?
   - Memory/performance trade-offs

2. **WebGL Rendering**
   - Would 900% performance boost justify complexity?
   - Battery impact on laptops?

3. **SSH Integration**
   - Built-in SSH client in Rust?
   - Integration with Tauri's IPC?

4. **AI Features**
   - Command suggestions based on history?
   - Error explanation?
   - Requires LLM integration

5. **Accessibility**
   - Screen reader support?
   - High contrast themes?
   - Keyboard-only navigation?

---

## 12. Conclusion

### Summary of Recommendations

**Immediate Priorities (v0.2.0):**
1. ✅ **OSC 133 Shell Integration** - Foundation for advanced features
2. ✅ **OSC 52 Clipboard** - Works over SSH, high user value
3. ✅ **DECSCUSR Cursor Shapes** - Low effort, completes existing feature
4. ✅ **Bracketed Paste Mode** - Security and usability

**Medium-Term (v0.2.5):**
1. **OSC 8 Hyperlinks** - Modern feature, easy to implement
2. **Scrollback Frontend** - Backend exists, expose to users
3. **Smart Selection** - Improved UX
4. **URL Pattern Detection** - Fallback for OSC 8

**Long-Term (v0.3.0+):**
1. **Search in Scrollback** - Power user feature
2. **Performance Optimizations** - Texture atlas, dirty rects
3. **Image Protocol** - Differentiation feature
4. **Ligature Support** - Developer UX

### Success Criteria

The plugin will be considered **competitive with iTerm2/Oh-My-Zsh** when:
- ✅ Shell integration works (marks, exit codes, navigation)
- ✅ Copy/paste works over SSH
- ✅ URLs are clickable
- ✅ Cursor shapes reflect Vim modes
- ✅ Scrollback is accessible
- ✅ Performance is 60 FPS under load
- ✅ Oh-My-Zsh themes render correctly

### Estimated Timeline

- **Phase 1 (Shell Integration):** 2-3 weeks
- **Phase 2 (Links & Selection):** 1-2 weeks
- **Phase 3 (Advanced):** 3-4 weeks

**Total: 6-9 weeks to feature parity with modern terminals**

---

## Appendix A: Escape Sequence Quick Reference

| Sequence | Description | Priority | Status |
|----------|-------------|----------|--------|
| `OSC 0;title ST` | Set window title | - | ✅ Implemented |
| `OSC 7;URL ST` | Set current directory | LOW | ❌ Not implemented |
| `OSC 8;;URL ST` | Start hyperlink | MEDIUM | ❌ Not implemented |
| `OSC 8;; ST` | End hyperlink | MEDIUM | ❌ Not implemented |
| `OSC 52;c;data ST` | Clipboard write | HIGH | ❌ Not implemented |
| `OSC 52;c;? ST` | Clipboard read | HIGH | ❌ Not implemented |
| `OSC 133;A ST` | Prompt start | HIGH | ❌ Not implemented |
| `OSC 133;B ST` | Command start | HIGH | ❌ Not implemented |
| `OSC 133;C ST` | Output start | HIGH | ❌ Not implemented |
| `OSC 133;D;code ST` | Output end | HIGH | ❌ Not implemented |
| `CSI Ps SP q` | Set cursor shape (DECSCUSR) | MEDIUM | ⚠️ Partial |
| `CSI ? 2004 h` | Enable bracketed paste | MEDIUM | ⚠️ Partial |
| `CSI ? 2004 l` | Disable bracketed paste | MEDIUM | ⚠️ Partial |

---

## Appendix B: Resources and References

### Official Documentation
- [iTerm2 Documentation](https://iterm2.com/documentation-one-page.html)
- [iTerm2 Escape Codes](https://iterm2.com/documentation-escape-codes.html)
- [Oh-My-Zsh Official Site](https://ohmyz.sh/)
- [WezTerm Documentation](https://wezterm.org/)
- [Kitty Terminal](https://sw.kovidgoyal.net/kitty/)

### Specifications
- [Hyperlinks in Terminal Emulators (OSC 8)](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
- [FinalTerm Semantic Prompts](https://gitlab.freedesktop.org/Per_Bothner/specifications/blob/master/proposals/semantic-prompts.md)
- [ECMA-48 Control Functions](https://www.ecma-international.org/publications-and-standards/standards/ecma-48/)

### Performance
- [VS Code Terminal Performance](https://code.visualstudio.com/blogs/2017/10/03/terminal-renderer)
- [How VS Code Terminal is Fast](https://gist.github.com/weihanglo/8b5efd2dbc4302d123af089e510f5326)

### Community
- [OSC 8 Adoption Tracker](https://github.com/Alhadis/OSC8-Adoption)
- [xterm.js Shell Integration](https://github.com/xtermjs/xterm.js/issues/576)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Next Review:** After v0.2.0 implementation
