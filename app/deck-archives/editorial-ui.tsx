"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const ICE_SWIPE_MS = 160;

export const editorialButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-none border border-[#28303b] bg-[#14181f] px-3 font-space text-[12px] font-semibold uppercase tracking-wider text-[#e2e8f0] shadow-none transition-colors hover:bg-[#e2e8f0] hover:text-[#0c0e12] focus:border-[#bfe5f3] focus:outline-none focus-visible:border-[#bfe5f3] disabled:pointer-events-none [&_.accent-mark]:bg-[#bfe5f3] hover:[&_.accent-mark]:bg-[#0c0e12]";

export function EditorialButton({
  className,
  type = "button",
  swipe = false,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { swipe?: boolean }) {
  const reducedMotion = useReducedMotion();
  const timer = React.useRef<number | null>(null);
  const locked = React.useRef(false);
  const onClickRef = React.useRef(onClick);

  React.useEffect(() => {
    onClickRef.current = onClick;
  });

  React.useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!swipe || reducedMotion !== false) {
      onClick?.(event);
      return;
    }
    if (locked.current) return;
    locked.current = true;
    const node = event.currentTarget;
    node.classList.remove("ice-swipe-run");
    void node.offsetWidth;
    node.classList.add("ice-swipe-run");
    timer.current = window.setTimeout(() => {
      locked.current = false;
      node.classList.remove("ice-swipe-run");
      onClickRef.current?.(event);
    }, ICE_SWIPE_MS);
  }

  return (
    <button
      type={type}
      className={cn(editorialButtonClass, swipe && "ice-swipe", className)}
      onClick={handleClick}
      {...props}
    />
  );
}

export const EditorialDialog = DialogPrimitive.Root;
export const EditorialDialogTrigger = DialogPrimitive.Trigger;
export const EditorialDialogClose = DialogPrimitive.Close;

export const EditorialDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onCloseAutoFocus, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="archives-dialog-overlay fixed inset-0 z-[80] bg-[rgba(12,14,18,0.88)]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "archives-dialog fixed left-1/2 top-1/2 z-[81] flex max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-none bg-transparent p-0 text-[#e2e8f0] shadow-none outline-none",
        className,
      )}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (!event.defaultPrevented) event.preventDefault();
      }}
      {...props}
    >
      <div className="archives-dialog-panel flex min-h-0 flex-1 flex-col overflow-hidden border border-[#28303b] bg-[#14181f] p-6">
        {children}
      </div>
      <span aria-hidden className="archives-dialog-rule" />
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
EditorialDialogContent.displayName = "EditorialDialogContent";

export const EditorialDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-space text-[13px] font-semibold uppercase tracking-wider text-white", className)}
    {...props}
  />
));
EditorialDialogTitle.displayName = "EditorialDialogTitle";

export const EditorialDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("font-space text-[12px] uppercase tracking-wider text-[#8a96a6]", className)}
    {...props}
  />
));
EditorialDialogDescription.displayName = "EditorialDialogDescription";

export const EditorialMenu = DropdownMenuPrimitive.Root;
export const EditorialMenuTrigger = DropdownMenuPrimitive.Trigger;

export const EditorialMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "archives-menu relative z-[70] min-w-[140px] rounded-none border border-[#28303b] bg-[#161a20] p-0 text-[#e2e8f0] shadow-none",
        className,
      )}
      {...props}
    >
      <div className="archives-menu-rows">{children}</div>
      <span aria-hidden className="archives-menu-rule" />
    </DropdownMenuPrimitive.Content>
  </DropdownMenuPrimitive.Portal>
));
EditorialMenuContent.displayName = "EditorialMenuContent";

export const EditorialMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex min-h-10 cursor-pointer select-none items-center border-b border-[#28303b] bg-[#161a20] px-4 font-space text-[12px] font-semibold uppercase tracking-wider text-[#e2e8f0] outline-none last:border-b-0 data-[highlighted]:bg-[#28303b] data-[highlighted]:text-[#e2e8f0]",
      className,
    )}
    {...props}
  />
));
EditorialMenuItem.displayName = "EditorialMenuItem";

export const EditorialTabs = TabsPrimitive.Root;
export const EditorialTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn("mb-4 flex items-center gap-2", className)} {...props} />
));
EditorialTabsList.displayName = "EditorialTabsList";

export const EditorialTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      editorialButtonClass,
      "px-3 py-1 data-[state=active]:bg-[#e2e8f0] data-[state=active]:text-[#0c0e12]",
      className,
    )}
    {...props}
  />
));
EditorialTabsTrigger.displayName = "EditorialTabsTrigger";

export const EditorialTabsContent = TabsPrimitive.Content;
