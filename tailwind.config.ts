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
        heading: ['"Orbitron"', "var(--font-orbitron)", "system-ui", "sans-serif"],
        display: ['"Orbitron"', "var(--font-orbitron)", "sans-serif"],
        ui: ['"Orbitron"', "var(--font-orbitron)", "system-ui", "sans-serif"],
        mda: ['"Orbitron"', "var(--font-orbitron)", "sans-serif"],
        armor: ['"Orbitron"', "var(--font-orbitron)", "sans-serif"],
        anton: ['"Orbitron"', "var(--font-orbitron)", "sans-serif"],
        "open-sans": [
          "var(--font-open-sans)",
          "Open Sans",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        orbitron: ["var(--font-orbitron)", "Orbitron", "sans-serif"],
        openSans: ["var(--font-open-sans)", "Open Sans", "sans-serif"],
        spaceGrotesk: ["Space Grotesk", "var(--font-open-sans)", "sans-serif"],
        "share-tech": ['"Orbitron"', "var(--font-orbitron)", "sans-serif"],
        sans: ['"Orbitron"', "var(--font-orbitron)", "system-ui", "sans-serif"],
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
        brandDark: "#0b0e11",
        steel: "#718096",
        steelMuted: "#4a5568",
        steelBorder: "#1a2029",
        ice: "#bfe5f3",
        iceLight: "#eaf7fc",
        plateSheet: "#eceff2",
        mda: {
          bg: "var(--mda-bg)",
          deep: "var(--mda-bg-deep)",
          surface: "var(--mda-surface)",
          raised: "var(--mda-surface-raised)",
          panel: "var(--mda-panel)",
          ink: "var(--mda-ink)",
          "ink-strong": "var(--mda-ink-strong)",
          "ink-soft": "var(--mda-ink-soft)",
          "ink-muted": "var(--mda-ink-muted)",
          chrome: "var(--mda-chrome)",
          "chrome-muted": "var(--mda-chrome-muted)",
          "chrome-deep": "var(--mda-chrome-deep)",
          "cta-ink": "var(--mda-cta-ink)",
          cyan: "var(--mda-cyan)",
          "cyan-soft": "var(--mda-cyan-soft)",
          sky: "var(--mda-sky)",
          "sky-strong": "var(--mda-sky-strong)",
          purple: "var(--mda-purple)",
          danger: "var(--mda-danger)",
          "danger-text": "var(--mda-danger-text)",
          success: "var(--mda-success)",
          "success-text": "var(--mda-success-text)",
          hazard: "var(--mda-hazard)",
          "hazard-text": "var(--mda-hazard-text)",
          bezel: "var(--mda-bezel)",
          focus: "var(--mda-focus)",
          inverse: "var(--mda-inverse)",
          "inverse-deep": "var(--mda-inverse-deep)",
          "inverse-text": "var(--mda-inverse-text)",
          watermark: "var(--mda-watermark)",
          bar: "var(--mda-header-bar)",
          "tier-1": "var(--mda-tier-1)",
          "tier-2": "var(--mda-tier-2)",
          "tier-3": "var(--mda-tier-3)",
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
        "mda-soft": "0 8px 24px rgba(58, 79, 92, 0.08)",
        "mda-lift": "0 14px 32px rgba(58, 79, 92, 0.14)",
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
