import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
    nextjs: {
      appDirectory: true,
    },
    backgrounds: {
      default: "mda-bg",
      values: [
        { name: "mda-bg", value: "#e6e9ea" },
        { name: "mda-surface", value: "#eef1f3" },
        { name: "mda-inverse", value: "#425969" },
      ],
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;
