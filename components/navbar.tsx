"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { Layers, Save, FlaskConical } from "lucide-react";
import { openLoginModal } from "../lib/helpers";
import { useUserStore } from "../store/useUserStore";
import { UserMenu } from "./ui/user-menu";
import MDAIcon from "@/public/images/MDA_Logo_One.svg";
import { MdaBrandTitle } from "@/components/mda/brand-lockup";

export default function Navbar() {
  const pathname = usePathname();
  const user = useUserStore((state) => state.user);

  const navItems = [
    {
      name: "Workshop",
      href: "/workshop",
      icon: <Layers className="h-4 w-4 mr-2" />,
    },
    {
      name: "Deck Archives",
      href: "/deck-archives",
      icon: <Save className="h-4 w-4 mr-2" />,
    },
    {
      name: "Deck Tester",
      href: "/deck-tester",
      icon: <FlaskConical className="h-4 w-4 mr-2" />,
    },
  ];

  return (
    <header className="w-full z-[30] border-b border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center w-full">
            <Link
              href="/"
              className="mr-6 flex items-center space-x-0"
              aria-label="Master Deck Alchemist home"
            >
              <div className="flex items-center gap-3">
                <MDAIcon className="w-14 h-14" aria-hidden="true" />
                <MdaBrandTitle className="text-white" />
              </div>
            </Link>
            <nav
              className="flex items-center space-x-2 md:space-x-4 mx-6"
              aria-label="Main navigation"
              role="navigation"
            >
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  variant={pathname === item.href ? "default" : "ghost"}
                  size="md"
                  asChild
                >
                  <Link
                    href={item.href}
                    className="flex items-center"
                    aria-current={pathname === item.href ? "page" : undefined}
                  >
                    {item.icon && <span aria-hidden="true">{item.icon}</span>}
                    <span
                      className={cn(
                        "hidden sm:inline-block",
                        pathname === item.href ? "font-medium" : "",
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
