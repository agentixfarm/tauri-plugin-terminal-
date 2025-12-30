---
sidebar_position: 1
---

# Theming Guide

Customize the terminal's appearance with built-in themes or create your own.

## Built-in Themes

The plugin includes 6 popular themes:

| Theme | Description |
|-------|-------------|
| `dark` | Default dark theme with high contrast |
| `light` | Clean light theme for bright environments |
| `solarized-dark` | Ethan Schoonover's Solarized Dark |
| `dracula` | Popular dark theme with purple accents |
| `nord` | Arctic, bluish color palette |
| `one-dark` | Atom's One Dark theme |

## Using a Theme

### At Session Creation

```typescript
const sessionId = await createSession({
  cwd: "/home/user",
  theme: "dracula",
});
```

### Changing Theme Dynamically

```typescript
import { setTheme, listThemes } from "@anthropic/tauri-plugin-terminal";

// List available themes
const themes = await listThemes();
// ["dark", "light", "solarized-dark", "dracula", "nord", "one-dark"]

// Change theme
await setTheme(sessionId, "nord");
```

### React Hook

```tsx
import { useTerminalTheme } from "@anthropic/tauri-plugin-terminal";

function ThemePicker({ sessionId }) {
  const { theme, themes, setTheme } = useTerminalTheme(sessionId);

  return (
    <select
      value={theme?.name || "dark"}
      onChange={(e) => setTheme(e.target.value)}
    >
      {themes.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
```

## Theme Structure

Each theme defines these colors:

```typescript
interface Theme {
  name: string;

  // Main colors
  foreground: Color;     // Default text color
  background: Color;     // Terminal background
  cursor: Color;         // Cursor color
  cursor_text: Color;    // Text under cursor
  selection: Color;      // Selection background
  selection_text: Color; // Selected text

  // Standard ANSI colors (0-7)
  black: Color;
  red: Color;
  green: Color;
  yellow: Color;
  blue: Color;
  magenta: Color;
  cyan: Color;
  white: Color;

  // Bright variants (8-15)
  bright_black: Color;
  bright_red: Color;
  bright_green: Color;
  bright_yellow: Color;
  bright_blue: Color;
  bright_magenta: Color;
  bright_cyan: Color;
  bright_white: Color;
}

interface Color {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}
```

## Creating Custom Themes

While custom theme registration isn't built into the plugin yet, you can use CSS variables to override the canvas colors:

```css
.my-terminal-wrapper {
  --terminal-bg: #1e1e2e;
  --terminal-fg: #cdd6f4;
  --terminal-cursor: #f5e0dc;
}
```

For full custom theme support, contribute to the [GitHub repo](https://github.com/agentixfarm/tauri-plugin-terminal).

## Font Configuration

The Terminal component accepts font settings:

```tsx
<Terminal
  sessionId={sessionId}
  fontSize={14}          // pixels
  fontFamily="JetBrains Mono, Fira Code, Menlo, monospace"
  lineHeight={1.2}       // multiplier
/>
```

### Recommended Fonts

For the best terminal experience, use a monospace font with programming ligatures:

1. **JetBrains Mono** - Free, excellent readability
2. **Fira Code** - Free, great ligatures
3. **SF Mono** - macOS system font
4. **Cascadia Code** - Microsoft's modern terminal font
5. **Source Code Pro** - Adobe's open source font

### Loading Web Fonts

```tsx
// In your App component
useEffect(() => {
  // Load JetBrains Mono from Google Fonts
  const link = document.createElement("link");
  link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap";
  link.rel = "stylesheet";
  document.head.appendChild(link);
}, []);
```

## Dark Mode Support

To sync with system dark mode:

```tsx
function App() {
  const [isDark, setIsDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const { setTheme } = useTerminalTheme(sessionId);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    setTheme(isDark ? "dark" : "light");
  }, [isDark, setTheme]);

  return <Terminal sessionId={sessionId} />;
}
```
