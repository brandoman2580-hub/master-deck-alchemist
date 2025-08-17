import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { LoginModal } from "@/components/ui/login-modal";

const inter = Inter({ subsets: ["latin"] });

const japanese = localFont({
  src: "./fonts/Japanese 3017.ttf",
  variable: "--font-japanese",
  display: "swap",
});

const cinzel = localFont({
  src: "./fonts/Cinzel-VariableFont_wght.ttf",
  variable: "--font-cinzel",
  display: "swap",
  weight: "400 900",
});

export const metadata: Metadata = {
  title: "Master Deck Alchemist",
  description: "Build and optimize your Yu-Gi-Oh! decks",
  icons: {
    icon: [{ url: "/potion_icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${japanese.variable} ${cinzel.variable}`}
      >
        <Providers>
          {children}
          <LoginModal />
        </Providers>
      </body>
    </html>
  );
}
