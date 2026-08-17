import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        display: ['"Orbitron"', "sans-serif"],
        ui: ['"Inter"', "system-ui", "sans-serif"],
        mda: ["var(--font-mda)", '"Roboto Condensed"', "sans-serif"],
        armor: ['"Space Armor"', "sans-serif"],
        anton: ["var(--font-anton)", "Impact", "sans-serif"],
        "open-sans": ["var(--font-open-sans)", "system-ui", "sans-serif"],
        "share-tech": ["var(--font-share-tech)", "ui-monospace", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Cyberpunk theme colors
        "cyb-900": "#06121a",
        "cyb-800": "#0b2633",
        "cyb-700": "#122a3a",
        "accent-cyan": "#14EFFF",
        "muted-50": "#B7C6D6",
        mda: {
          bg: "var(--mda-bg)",
          deep: "var(--mda-bg-deep)",
          surface: "var(--mda-surface)",
          raised: "var(--mda-surface-raised)",
          cyan: "var(--mda-cyan)",
          "cyan-soft": "var(--mda-cyan-soft)",
          purple: "var(--mda-purple)",
          text: "var(--mda-text)",
          muted: "var(--mda-text-muted)",
          danger: "var(--mda-danger)",
          success: "var(--mda-success)",
          bar: "var(--mda-header-bar)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backdropBlur: {
        xs: "2px",
        sm: "6px",
        md: "12px",
      },
      borderWidth: {
        "1.5": "1.5px",
      },
      transitionTimingFunction: {
        "cyb-ease": "cubic-bezier(.2,.9,.35,1)",
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        "elegant": "cubic-bezier(0.25, 0.1, 0.25, 1)",
        "gentle": "cubic-bezier(0.2, 0, 0, 1)",
      },
      boxShadow: {
        "neon-cyan":
          "0 4px 24px rgba(20,239,255,0.06), inset 0 1px 0 rgba(20,239,255,0.03)",
        "glass-soft": "0 6px 30px rgba(2,6,23,0.6)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: {
            opacity: "0",
            transform: "translateY(20px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-down": {
          from: {
            opacity: "0",
            transform: "translateY(-20px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "scale-in": {
          from: {
            opacity: "0",
            transform: "scale(0.95)",
          },
          to: {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        "shimmer": {
          "0%": {
            transform: "translateX(-100%)",
          },
          "100%": {
            transform: "translateX(100%)",
          },
        },
        "float": {
          "0%, 100%": {
            transform: "translateY(0px)",
          },
          "50%": {
            transform: "translateY(-10px)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-smooth",
        "slide-up": "slide-up 0.3s ease-smooth",
        "slide-down": "slide-down 0.3s ease-smooth",
        "scale-in": "scale-in 0.3s ease-elegant",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
