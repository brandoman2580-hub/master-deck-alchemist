import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { LoginModal } from "../components/ui/login-modal";
import { FocusManager } from "./(lib)/FocusManager";
import { SkipLink } from "../components/skip-link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Master Deck Alchemist",
  description: "Build and optimize your Yu-Gi-Oh! decks",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: [
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-256x256.png", sizes: "256x256", type: "image/png" },
      { url: "/favicon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/favicon-64x64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          ${inter.className}
          min-h-screen
          flex flex-col
          overflow-x-hidden
        `}
      >
        <Providers>
          <SkipLink />
          <FocusManager />
          {children}
          <LoginModal />
        </Providers>
      </body>
    </html>
  );
}
