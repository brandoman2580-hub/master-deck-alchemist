import type { Metadata } from "next"
import { Inter } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { Providers } from "./providers"
import { LoginModal } from "@/components/ui/login-modal"

const inter = Inter({ subsets: ["latin"] })

const audiowide = localFont({
  src: "./fonts/Audiowide-Regular.ttf",
  variable: "--font-audiowide",
  display: "swap",
})

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  display: "swap",
})

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
})

const cinzel = localFont({
  src: "./fonts/Cinzel-VariableFont_wght.ttf",
  variable: "--font-cinzel",
  display: "swap",
})

const orbitron = localFont({
  src: "./fonts/Orbitron-VariableFont_wght.ttf",
  variable: "--font-orbitron",
  display: "swap",
})

const rowdies = localFont({
  src: [
    {
      path: "./fonts/Rowdies-Light.ttf",
      weight: "300",
    },
    {
      path: "./fonts/Rowdies-Regular.ttf",
      weight: "400",
    },
    {
      path: "./fonts/Rowdies-Bold.ttf",
      weight: "700",
    },
  ],
  variable: "--font-rowdies",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Master Deck Alchemist",
  description: "Build and optimize your Yu-Gi-Oh! decks",
  icons: {
    icon: "/icon.svg",
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${audiowide.variable} ${geist.variable} ${geistMono.variable} ${cinzel.variable} ${orbitron.variable} ${rowdies.variable}`}>
        <Providers>
          {children}
          <LoginModal />
        </Providers>
      </body>
    </html>
  )
}
