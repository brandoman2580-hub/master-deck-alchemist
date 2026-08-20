"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import MDAIcon from "@/public/images/MDA_Logo_One.svg";
import { useUserStore } from "@/store/useUserStore";
import { UserMenu } from "@/components/ui/user-menu";
import { ClipButton } from "@/components/mda/clip-button";
import { MdaBrandTitle } from "@/components/mda/brand-lockup";
import { cn } from "@/lib/utils";

export type MdaAppHeaderProps = {
  className?: string;
  /** Visual theme — light for Alt2 landing, dark for app shells. */
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
      <MDAIcon className="h-8 w-8 shrink-0" aria-hidden />
      <MdaBrandTitle />
    </>
  );
}

export function MdaAppHeader({
  className,
  theme = "dark",
  onLoginClick,
  hideLoginButton = false,
  logoHref = "/",
}: MdaAppHeaderProps): ReactNode {
  const user = useUserStore((state) => state.user);
  const isLight = theme === "light";
  const brandClassName = "flex items-center gap-4";

  return (
    <header
      className={cn(
        "flex w-full items-center justify-between px-6 py-2.5",
        isLight ? "h-auto min-h-[68px]" : "h-[68px]",
        className,
      )}
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
          variant={isLight ? "headerLogin" : "filled"}
          onClick={onLoginClick}
          className={cn("min-w-[115px]", isLight ? "text-2xl" : "text-sm")}
        >
          Login
        </ClipButton>
      ) : null}
    </header>
  );
}
