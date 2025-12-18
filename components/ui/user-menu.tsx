"use client";

import { useUserStore } from "../../store/useUserStore";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";
import { HelpCircle, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

function getInitials(
  user: { user_metadata?: { name?: string }; email?: string } | null,
) {
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

export function UserMenu() {
  const user = useUserStore((state) => state.user);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate dropdown position when opening or scrolling
  useEffect(() => {
    if (!mounted) return;

    const updatePosition = () => {
      if (dropdownOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8, // mt-2 = 8px
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      // Use a small delay to avoid immediate closure
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClick);
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClick);
      };
    }
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    globalThis.location.reload();
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className="w-10 h-10 rounded-lg bg-white/10 text-white font-bold flex items-center justify-center hover:bg-white/15 border border-white/20 transition-colors"
        aria-label="User menu"
        onClick={() => setDropdownOpen((v) => !v)}
      >
        {getInitials(user)}
      </button>
      {mounted &&
        dropdownOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-48 z-[100]"
            style={{
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
            }}
          >
            <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg py-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 cursor-not-allowed"
                startIcon={<HelpCircle className="mr-2" />}
                disabled
              >
                Help
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
                startIcon={<LogOut className="mr-2" />}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
