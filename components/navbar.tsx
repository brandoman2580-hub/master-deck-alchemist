"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
// import { ModeToggle } from "@/components/mode-toggle"
import { cn } from "@/lib/utils";
import { Layers, Save, FlaskConical } from "lucide-react";
import { openLoginModal } from "@/lib/helpers";
import { useUserStore } from "@/store/useUserStore";
import { UserMenu } from "./ui/user-menu";
import PotionLogo from "@/public/images/potion_icon.svg"

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
    }
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-black/40 backdrop-blur supports-[backdrop-filter]:bg-transparent">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-0">
          <span className="hidden font-bold sm:flex sm:items-center font-rowdies text-3xl">
            <PotionLogo className="w-14 h-14" />
            MASTER DECK <span className="text-red-600 pl-2">ALCHEMIST</span>
          </span>
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
            <Button
              variant="outline"
              size="md"
              onClick={openLoginModal}
            >
              Login
            </Button>
          ) : (
            <UserMenu />
          )}
        </div>
      </div>
    </header>
  );
}
