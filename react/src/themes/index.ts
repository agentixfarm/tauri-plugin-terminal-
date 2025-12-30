/**
 * Terminal themes.
 */

export { dark } from "./dark";
export { light } from "./light";

export const themes = {
  dark: () => import("./dark").then((m) => m.dark),
  light: () => import("./light").then((m) => m.light),
};

export default themes;
