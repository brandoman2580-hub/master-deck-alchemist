"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { cn } from "@/lib/utils"
import { Search, Layers, Save } from "lucide-react"
import { openLoginModal } from "@/lib/helpers"
import { useUserStore } from "@/store/useUserStore"
import { UserMenu } from "./ui/user-menu"
import HeaderLogo from "@/public/images/mda_header_logo.svg";

export default function Navbar() {
  const pathname = usePathname()
  const user = useUserStore((state) => state.user)

  const navItems = [
    {
      name: "Card Browser",
      href: "/card-browser",
      icon: <Search className="h-4 w-4 mr-2" />,
    },
    {
      name: "Deck Builder",
      href: "/deck-builder",
      icon: <Layers className="h-4 w-4 mr-2" />,
    },
    {
      name: "Saved Decks",
      href: "/saved-decks",
      icon: <Save className="h-4 w-4 mr-2" />,
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <HeaderLogo alt="Master Deck Alchemist" className="h-32 w-52" />
        </Link>
        <nav className="flex items-center space-x-2 md:space-x-4 mx-6">
          {navItems.map((item) => (
            <Button key={item.href} variant={pathname === item.href ? "default" : "ghost"} size="sm" asChild>
              <Link href={item.href} className="flex items-center">
                {item.icon}
                <span className={cn("hidden sm:inline-block", pathname === item.href ? "font-medium" : "")}>
                  {item.name}
                </span>
              </Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center space-x-4">
          <ModeToggle />
          {!user ? (
          <button className="btn btn-primary" onClick={openLoginModal}>Login</button>
        ) : (
          <UserMenu />
        )}
        </div>
      </div>
    </header>
  )
}
