import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "tauri-plugin-terminal",
  tagline: "The World's Best Terminal UX for Tauri Applications",
  favicon: "img/favicon.ico",

  url: "https://agentixfarm.github.io",
  baseUrl: "/tauri-plugin-terminal/",

  organizationName: "agentixfarm",
  projectName: "tauri-plugin-terminal",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/agentixfarm/tauri-plugin-terminal/tree/main/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/social-card.png",
    navbar: {
      title: "tauri-plugin-terminal",
      logo: {
        alt: "Terminal Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://github.com/agentixfarm/tauri-plugin-terminal",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Getting Started",
              to: "/docs/getting-started",
            },
            {
              label: "API Reference",
              to: "/docs/api/rust",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub Discussions",
              href: "https://github.com/agentixfarm/tauri-plugin-terminal/discussions",
            },
            {
              label: "Discord",
              href: "https://discord.gg/tauri",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/agentixfarm/tauri-plugin-terminal",
            },
            {
              label: "crates.io",
              href: "https://crates.io/crates/tauri-plugin-terminal",
            },
            {
              label: "npm",
              href: "https://www.npmjs.com/package/@anthropic/tauri-plugin-terminal",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Agentix Farm. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["rust", "toml", "bash"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
