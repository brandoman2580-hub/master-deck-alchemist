"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import MDAIcon from "@/public/images/MDA_Logo_One.svg";
import { useUserStore } from "@/store/useUserStore";
import { UserMenu } from "@/components/ui/user-menu";
import { ClipButton } from "@/components/mda/clip-button";
import { cn } from "@/lib/utils";

export type MdaAppHeaderProps = {
  className?: string;
  /** Visual theme — defaults to light (v2). Kept for call-site compat. */
  theme?: "dark" | "light";
  /** When set, shows a clipped Login CTA. */
  onLoginClick?: () => void;
  /** Hide the header Login CTA (e.g. while auth modal is open). */
  hideLoginButton?: boolean;
  /**
   * Logo navigation target. Pass `null` for a non-link decorative brand
   * (Landing). Defaults to `/` on app shells.
   */
  logoHref?: string | null;
};

function BrandMark(): ReactNode {
  return (
    <>
      <MDAIcon className="h-8 w-8 shrink-0 text-mda-purple" aria-hidden />
      <span className="font-display text-[22px] font-black uppercase tracking-wide text-mda-ink sm:text-2xl">
        Master Deck Alchemist
      </span>
    </>
  );
}

export function MdaAppHeader({
  className,
  theme = "light",
  onLoginClick,
  hideLoginButton = false,
  logoHref = "/",
}: MdaAppHeaderProps): ReactNode {
  const user = useUserStore((state) => state.user);
  const brandClassName = "flex items-center gap-4";

  return (
    <header
      className={cn(
        "flex h-auto min-h-[68px] w-full items-center justify-between px-6 py-2.5",
        className,
      )}
      data-theme={theme}
    >
      {logoHref ? (
        <Link
          href={logoHref}
          className={brandClassName}
          aria-label="Master Deck Alchemist home"
        >
          <BrandMark />
        </Link>
      ) : (
        <div className={brandClassName} aria-label="Master Deck Alchemist">
          <BrandMark />
        </div>
      )}

      {user ? (
        <UserMenu />
      ) : onLoginClick && !hideLoginButton ? (
        <ClipButton
          size="sm"
          variant="headerLogin"
          onClick={onLoginClick}
          className="min-w-[115px] text-2xl"
        >
          Login
        </ClipButton>
      ) : null}
    </header>
  );
}
