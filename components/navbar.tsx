"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui/button";
// import { ModeToggle } from "@/components/mode-toggle"
import { cn } from "../lib/utils";
import { Layers, Save, FlaskConical } from "lucide-react";
import { openLoginModal } from "../lib/helpers";
import { useUserStore } from "../store/useUserStore";
import { UserMenu } from "./ui/user-menu";
import MDAIcon from "@/public/images/MDA_Logo_One.svg"

export default function Navbar() {
  const pathname = usePathname();
  const user = useUserStore((state) => state.user);

  const navItems = [
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
    {
      name: "Deck Tester",
      href: "/deck-tester",
      icon: <FlaskConical className="h-4 w-4 mr-2" />,
    },
  ];

  return (
    <header className="sticky top-4 z-[30]">
      <div className="mx-8">
        <div className="container flex h-14 items-center bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-[0_0_20px_rgba(56,189,248,0.15)] px-4 glass-panel border-thin-neon">
          <Link href="/" className="mr-6 flex items-center space-x-0">
            <div className="flex items-center gap-3">
              <MDAIcon className="w-14 h-14" />
              <span
                className="tracking-wider uppercase text-cyan-400"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Master Deck Alchemist
              </span>
            </div>
          </Link>
          <nav className="flex items-center space-x-2 md:space-x-4 mx-6">
            {navItems.map((item) => (
              <Button
                key={item.href}
                variant={pathname === item.href ? "default" : "ghost"}
                size="md"
                asChild
              >
                <Link href={item.href} className="flex items-center">
                  <span
                    className={cn(
                      "hidden sm:inline-block text-white",
                      pathname === item.href ? "font-medium" : ""
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex items-center space-x-4">
            {!user ? (
              <Button variant="outline" size="md" onClick={openLoginModal}>
                Login
              </Button>
            ) : (
              <UserMenu />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
