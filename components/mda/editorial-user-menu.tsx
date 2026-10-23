"use client";

import type { ReactNode } from "react";
import { HelpCircle, LogOut } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { supabase } from "@/lib/supabaseClient";
import {
  EditorialMenu,
  EditorialMenuContent,
  EditorialMenuItem,
  EditorialMenuTrigger,
} from "@/app/deck-archives/editorial-ui";
import "@/app/deck-archives/archives-screen.css";

function getInitials(
  user: { user_metadata?: { name?: string }; email?: string } | null,
): string {
  if (!user) return "U";
  const name = user.user_metadata?.name;
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }
  if (user.email) return user.email[0].toUpperCase();
  return "U";
}

/**
 * Avatar menu for the editorial wordmark bar.
 * Same actions as the glass user menu, in the steel plate used by Archives and Workshop.
 */
export function EditorialUserMenu(): ReactNode {
  const user = useUserStore((state) => state.user);

  const handleLogout = async (): Promise<void> => {
    await supabase.auth.signOut();
    globalThis.location.reload();
  };

  if (!user) return null;

  return (
    <EditorialMenu>
      <EditorialMenuTrigger
        aria-label="User menu"
        className="flex h-10 w-10 items-center justify-center border border-[#28303b] bg-[#14181f] text-[13px] font-bold uppercase tracking-wide text-[#e2e8f0] transition-colors hover:border-[#14181f] hover:bg-[#e2e8f0] hover:text-[#14181f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3] data-[state=open]:border-[#14181f] data-[state=open]:bg-[#e2e8f0] data-[state=open]:text-[#14181f]"
      >
        {getInitials(user)}
      </EditorialMenuTrigger>
      <EditorialMenuContent align="end" className="w-56">
        {user.email ? (
          <p className="truncate border-b border-[#28303b] px-4 py-2 font-space text-[12px] normal-case tracking-normal text-[#8a96a6]">
            {user.email}
          </p>
        ) : null}
        <EditorialMenuItem
          disabled
          className="data-[highlighted]:!bg-[#e2e8f0] data-[highlighted]:!text-[#14181f]"
        >
          <HelpCircle className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          Help
        </EditorialMenuItem>
        <EditorialMenuItem
          className="data-[highlighted]:!bg-[#e2e8f0] data-[highlighted]:!text-[#14181f]"
          onSelect={() => {
            void handleLogout();
          }}
        >
          <LogOut className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          Logout
        </EditorialMenuItem>
      </EditorialMenuContent>
    </EditorialMenu>
  );
}
