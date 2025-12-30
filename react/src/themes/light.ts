/**
 * Light theme for terminal.
 */

import type { Theme } from "../../../guest-js/types";

export const light: Theme = {
  name: "light",
  foreground: { r: 0, g: 0, b: 0 },
  background: { r: 255, g: 255, b: 255 },
  cursor: { r: 0, g: 0, b: 0 },
  cursor_text: { r: 255, g: 255, b: 255 },
  selection: { r: 178, g: 215, b: 255 },
  selection_text: { r: 0, g: 0, b: 0 },
  black: { r: 0, g: 0, b: 0 },
  red: { r: 205, g: 49, b: 49 },
  green: { r: 0, g: 128, b: 0 },
  yellow: { r: 128, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  magenta: { r: 128, g: 0, b: 128 },
  cyan: { r: 0, g: 128, b: 128 },
  white: { r: 192, g: 192, b: 192 },
  bright_black: { r: 128, g: 128, b: 128 },
  bright_red: { r: 255, g: 0, b: 0 },
  bright_green: { r: 0, g: 255, b: 0 },
  bright_yellow: { r: 255, g: 255, b: 0 },
  bright_blue: { r: 0, g: 0, b: 255 },
  bright_magenta: { r: 255, g: 0, b: 255 },
  bright_cyan: { r: 0, g: 255, b: 255 },
  bright_white: { r: 255, g: 255, b: 255 },
};

export default light;
