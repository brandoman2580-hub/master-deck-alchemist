import type { Config } from "tailwindcss"

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
        japanese: ["var(--font-japanese)", "sans-serif"],
        cinzel: ["var(--font-cinzel)", "serif", "Times New Roman", "Times", "serif"],
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        hud: ["var(--font-heading)", "system-ui", "sans-serif"],
        display: ['"Orbitron"', 'sans-serif'],
        ui: ['"Inter"', 'system-ui', 'sans-serif'],
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
        // HUD theme colors - Iron Man / Arc Reactor style
        hud: {
          bg: "#020617", // slate-950
          surface: "#0f172a", // slate-900
          "surface-light": "#1e293b", // slate-800
          primary: "#06b6d4", // cyan-500
          "primary-soft": "#22d3ee", // cyan-400
          "primary-dark": "#0891b2", // cyan-600
          accent: "#06b6d4", // cyan-500
          "accent-soft": "#22d3ee", // cyan-400
          border: "rgba(6, 182, 212, 0.3)", // cyan-500/30
          "border-soft": "rgba(6, 182, 212, 0.15)", // cyan-500/15
          "border-strong": "rgba(34, 211, 238, 0.5)", // cyan-400/50
          fg: "#f1f5f9", // slate-100
          "fg-muted": "#cbd5e1", // slate-300
          "fg-dim": "#94a3b8", // slate-400
          glow: "rgba(56, 189, 248, 0.25)", // cyan-400/25
          "glow-strong": "rgba(56, 189, 248, 0.4)", // cyan-400/40
          "glow-focus": "rgba(34, 211, 238, 0.6)", // cyan-400/60
        },
        // Cyberpunk theme colors
        'cyb-900': '#06121a',
        'cyb-800': '#0b2633',
        'cyb-700': '#122a3a',
        'accent-cyan': '#14EFFF',
        'muted-50': '#B7C6D6',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "hud": "0.75rem", // rounded-xl
        "hud-lg": "1rem", // rounded-2xl
      },
      backdropBlur: {
        xs: '2px',
        sm: '6px',
        md: '12px',
      },
      borderWidth: {
        '1.5': '1.5px'
      },
      transitionTimingFunction: {
        'cyb-ease': 'cubic-bezier(.2,.9,.35,1)'
      },
      boxShadow: {
        "hud-glow": "0 0 20px rgba(56, 189, 248, 0.25)",
        "hud-glow-strong": "0 0 40px rgba(56, 189, 248, 0.4)",
        "hud-glow-focus": "0 0 0 2px rgba(34, 211, 238, 0.6), 0 0 30px rgba(56, 189, 248, 0.3)",
        "hud-border": "inset 0 0 0 1px rgba(6, 182, 212, 0.3)",
        "hud-border-strong": "inset 0 0 0 1px rgba(34, 211, 238, 0.5)",
        'neon-cyan': '0 4px 24px rgba(20,239,255,0.06), inset 0 1px 0 rgba(20,239,255,0.03)',
        'glass-soft': '0 6px 30px rgba(2,6,23,0.6)',
      },
      clipPath: {
        "hud-cut": "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
        "hud-cut-sm": "polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)",
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
        "hud-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "hud-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 20px rgba(56, 189, 248, 0.25)",
            borderColor: "rgba(6, 182, 212, 0.3)",
          },
          "50%": { 
            boxShadow: "0 0 30px rgba(56, 189, 248, 0.4)",
            borderColor: "rgba(34, 211, 238, 0.5)",
          },
        },
        "hud-border-sweep": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "hud-pulse": "hud-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "hud-glow": "hud-glow 2s ease-in-out infinite",
        "hud-border-sweep": "hud-border-sweep 3s ease infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
