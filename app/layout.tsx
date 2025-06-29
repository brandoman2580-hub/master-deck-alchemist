import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { LoginModal } from "@/components/ui/login-modal"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Master Deck Alchemist",
  description: "Build and optimize your Yu-Gi-Oh! decks",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <LoginModal />
        </Providers>
      </body>
    </html>
  )
}
