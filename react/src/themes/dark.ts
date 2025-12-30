/**
 * Dark theme for terminal.
 */

import type { Theme } from "../../../guest-js/types";

export const dark: Theme = {
  name: "dark",
  foreground: { r: 229, g: 229, b: 229 },
  background: { r: 24, g: 24, b: 27 },
  cursor: { r: 255, g: 255, b: 255 },
  cursor_text: { r: 0, g: 0, b: 0 },
  selection: { r: 68, g: 68, b: 76 },
  selection_text: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  red: { r: 205, g: 49, b: 49 },
  green: { r: 13, g: 188, b: 121 },
  yellow: { r: 229, g: 229, b: 16 },
  blue: { r: 36, g: 114, b: 200 },
  magenta: { r: 188, g: 63, b: 188 },
  cyan: { r: 17, g: 168, b: 205 },
  white: { r: 229, g: 229, b: 229 },
  bright_black: { r: 102, g: 102, b: 102 },
  bright_red: { r: 241, g: 76, b: 76 },
  bright_green: { r: 35, g: 209, b: 139 },
  bright_yellow: { r: 245, g: 245, b: 67 },
  bright_blue: { r: 59, g: 142, b: 234 },
  bright_magenta: { r: 214, g: 112, b: 214 },
  bright_cyan: { r: 41, g: 184, b: 219 },
  bright_white: { r: 255, g: 255, b: 255 },
};

export default dark;
