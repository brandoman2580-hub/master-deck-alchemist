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
import MDAIcon from "@/public/images/MDA_Logo_One.svg";
import CutCornerWrapper from "../components/cut-corner-wrapper";

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
        <CutCornerWrapper
          size="md"
          hoverHighlight
          className="container flex h-14 items-center"
          padding="0"
          style={{
            ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
            ["--cut-corner-stroke-hover" as any]: "rgba(20,239,255,0.52)",
            ["--cut-corner-fill" as any]: "transparent",
            backdropFilter: "blur(6px) saturate(120%)",
            WebkitBackdropFilter: "blur(6px) saturate(120%)",
          }}
        >
          <div className="flex h-14 items-center w-full px-4">
            <Link href="/" className="mr-6 flex items-center space-x-0" aria-label="Master Deck Alchemist home">
              <div className="flex items-center gap-3">
                <MDAIcon className="w-14 h-14" aria-hidden="true" />
                <span
                  className="tracking-wider uppercase text-cyan-400"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Master Deck Alchemist
                </span>
              </div>
            </Link>
            <nav className="flex items-center space-x-2 md:space-x-4 mx-6" aria-label="Main navigation" role="navigation">
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
        </CutCornerWrapper>
      </div>
    </header>
  );
}
