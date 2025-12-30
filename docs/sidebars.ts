import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    "intro",
    "getting-started",
    {
      type: "category",
      label: "API Reference",
      items: ["api/rust", "api/typescript"],
    },
    {
      type: "category",
      label: "Guides",
      items: ["guides/theming", "guides/multi-session", "guides/integration"],
    },
    {
      type: "category",
      label: "Examples",
      items: ["examples/basic", "examples/advanced"],
    },
  ],
};

export default sidebars;
