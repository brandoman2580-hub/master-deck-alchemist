"use client"

import { ThemeProvider } from "next-themes"
import { DeckProvider } from "@/context/deck-context"
import Navbar from "@/components/navbar"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <DeckProvider>
                <div className="flex min-h-screen flex-col">
                    <Navbar />
                    <main className="flex-1">{children}</main>
                </div>
            </DeckProvider>
        </ThemeProvider>
    )
}
