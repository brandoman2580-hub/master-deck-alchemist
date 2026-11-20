"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, LogOut } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";
import { HelpDialog } from "@/components/mda/help/help-dialog";
import { MdaGlassPopover } from "@/components/mda/glass-popover";
import { cn } from "@/lib/utils";

const supabase = createClient();

function getInitials(
  user: { user_metadata?: { name?: string }; email?: string } | null,
): string {
  if (!user) return "U";
  const name = user.user_metadata?.name as string | undefined;
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }
  if (user.email) return user.email[0].toUpperCase();
  return "U";
}

const menuItemClass =
  "flex w-full items-center gap-2 px-3 py-2.5 text-left font-mda text-sm font-semibold uppercase tracking-wide text-mda-ink transition-[background-color,color] duration-200 ease-in-out hover:bg-mda-ink/10 hover:text-mda-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-mda-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

/**
 * Avatar menu — {@link MdaGlassPopover} shell, portaled above page chrome.
 * Stay below the magnetic cursor (z≈10000) so the morph ring paints on top.
 * While open, magnetic targeting scopes to this menu (see magnetic-targets).
 */
export function UserMenu(): ReactNode {
  const user = useUserStore((state) => state.user);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const updatePosition = (): void => {
      if (dropdownOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
        });
      }
    };

    if (dropdownOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [dropdownOpen, mounted]);

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setDropdownOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key !== "Escape") return;
      setDropdownOpen(false);
      triggerRef.current?.focus();
    }

    if (!dropdownOpen) return;

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleLogout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    globalThis.location.reload();
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-magnetic
        className={cn(
          "relative flex h-10 w-10 items-center justify-center border-2 border-mda-ink/40 font-display text-sm font-bold text-mda-ink",
          "transition-[background-color,border-color] duration-200 ease-in-out",
          "hover:bg-mda-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-focus",
          dropdownOpen && "border-mda-cyan bg-mda-ink/10",
        )}
        aria-label="User menu"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        onClick={() => setDropdownOpen((v) => !v)}
      >
        {getInitials(user)}
      </button>
      {mounted &&
        dropdownOpen &&
        createPortal(
          <div
            ref={menuRef}
            data-mda-user-menu
            role="menu"
            aria-label="User menu"
            className="pointer-events-auto fixed z-[1000] w-56"
            style={{
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
            }}
          >
            <MdaGlassPopover panelClassName="py-1">
              {user.email ? (
                <p className="truncate px-3 py-2 font-open-sans text-xs text-mda-ink-muted">
                  {user.email}
                </p>
              ) : null}
              <button
                type="button"
                role="menuitem"
                data-magnetic
                className={menuItemClass}
                onClick={() => {
                  setDropdownOpen(false);
                  setHelpOpen(true);
                }}
              >
                <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
                Help
              </button>
              <button
                type="button"
                role="menuitem"
                data-magnetic
                className={menuItemClass}
                onClick={() => {
                  void handleLogout();
                }}
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                Logout
              </button>
            </MdaGlassPopover>
          </div>,
          document.body,
        )}
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} returnFocusRef={triggerRef} />
    </div>
  );
}
