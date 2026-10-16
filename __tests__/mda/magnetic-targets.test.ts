import {
  getMagneticSearchRoot,
  nearestMagneticTarget,
} from "@/components/mda/magnetic-cursor/magnetic-targets";

function mockRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("magnetic targeting", () => {
  const originalElementFromPoint = document.elementFromPoint;
  const originalElementsFromPoint = document.elementsFromPoint;

  afterEach(() => {
    document.body.innerHTML = "";
    if (originalElementFromPoint) {
      document.elementFromPoint = originalElementFromPoint;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (document as any).elementFromPoint;
    }
    if (originalElementsFromPoint) {
      document.elementsFromPoint = originalElementsFromPoint;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (document as any).elementsFromPoint;
    }
  });

  it("snaps to a nearby data-magnetic node", () => {
    const button = document.createElement("button");
    button.setAttribute("data-magnetic", "");
    document.body.appendChild(button);
    mockRect(button, { left: 100, top: 100, width: 80, height: 32 });

    const target = nearestMagneticTarget(120, 110);
    expect(target).not.toBeNull();
    expect(target?.width).toBe(80);
    expect(target?.height).toBe(32);
  });

  it("ignores background magnetic nodes while a modal dialog is open", () => {
    const background = document.createElement("button");
    background.setAttribute("data-magnetic", "");
    document.body.appendChild(background);
    mockRect(background, { left: 20, top: 20, width: 200, height: 120 });

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const openBtn = document.createElement("button");
    openBtn.setAttribute("data-magnetic", "");
    openBtn.textContent = "Open in Workshop";
    dialog.appendChild(openBtn);
    const closeBtn = document.createElement("button");
    closeBtn.setAttribute("data-magnetic", "");
    closeBtn.textContent = "Close";
    dialog.appendChild(closeBtn);
    document.body.appendChild(dialog);
    mockRect(dialog, { left: 380, top: 380, width: 320, height: 120 });
    mockRect(openBtn, { left: 400, top: 400, width: 160, height: 40 });
    mockRect(closeBtn, { left: 580, top: 400, width: 80, height: 40 });

    expect(getMagneticSearchRoot()).toBe(dialog);
    expect(nearestMagneticTarget(40, 40)).toBeNull();
    expect(nearestMagneticTarget(420, 410)?.width).toBe(160);
    expect(nearestMagneticTarget(600, 410)?.width).toBe(80);
  });

  it("ignores background magnetic nodes while an archive action popover is open", () => {
    const background = document.createElement("article");
    background.setAttribute("data-magnetic", "");
    document.body.appendChild(background);
    mockRect(background, { left: 20, top: 20, width: 200, height: 120 });

    const popover = document.createElement("div");
    popover.setAttribute("data-mda-action-popover", "");
    popover.setAttribute("data-state", "open");
    const confirm = document.createElement("button");
    confirm.setAttribute("data-magnetic", "");
    confirm.textContent = "Confirm";
    popover.appendChild(confirm);
    document.body.appendChild(popover);
    mockRect(popover, { left: 290, top: 290, width: 60, height: 60 });
    mockRect(confirm, { left: 300, top: 300, width: 40, height: 40 });

    expect(getMagneticSearchRoot()).toBe(popover);
    expect(nearestMagneticTarget(40, 40)).toBeNull();
    expect(nearestMagneticTarget(310, 310)?.width).toBe(40);
  });

  it("scopes magnetic targeting to the open user menu over underlying CTAs", () => {
    const newDeck = document.createElement("button");
    newDeck.setAttribute("data-magnetic", "");
    newDeck.textContent = "New Deck";
    document.body.appendChild(newDeck);
    mockRect(newDeck, { left: 200, top: 80, width: 140, height: 40 });

    const menu = document.createElement("div");
    menu.setAttribute("data-mda-user-menu", "");
    const logout = document.createElement("button");
    logout.setAttribute("data-magnetic", "");
    logout.textContent = "Logout";
    menu.appendChild(logout);
    document.body.appendChild(menu);
    mockRect(menu, { left: 210, top: 70, width: 180, height: 80 });
    mockRect(logout, { left: 220, top: 90, width: 160, height: 36 });

    // Punch-through: hit stack lists New Deck above the menu item
    document.elementsFromPoint = ((x: number, y: number) => {
      if (x >= 220 && x <= 380 && y >= 90 && y <= 126) {
        return [newDeck, logout, menu];
      }
      return [newDeck];
    }) as typeof document.elementsFromPoint;

    expect(getMagneticSearchRoot()).toBe(menu);
    expect(nearestMagneticTarget(250, 100)?.width).toBe(160);
    // Pointer outside menu root → suppress background magnets
    expect(nearestMagneticTarget(40, 40)).toBeNull();
  });

  it("uses geometric menu targets when hit-testing punches fully through glass", () => {
    const newDeck = document.createElement("button");
    newDeck.setAttribute("data-magnetic", "");
    document.body.appendChild(newDeck);
    mockRect(newDeck, { left: 200, top: 80, width: 140, height: 40 });

    const menu = document.createElement("div");
    menu.setAttribute("data-mda-user-menu", "");
    const logout = document.createElement("button");
    logout.setAttribute("data-magnetic", "");
    menu.appendChild(logout);
    document.body.appendChild(menu);
    mockRect(menu, { left: 210, top: 70, width: 180, height: 80 });
    mockRect(logout, { left: 220, top: 90, width: 160, height: 36 });

    document.elementsFromPoint = (() => [newDeck]) as typeof document.elementsFromPoint;

    expect(nearestMagneticTarget(250, 100)?.width).toBe(160);
  });

  it("prefers the magnetic control under the pointer over a larger overlapping card", () => {
    const card = document.createElement("article");
    card.setAttribute("data-magnetic", "");
    document.body.appendChild(card);
    mockRect(card, { left: 0, top: 0, width: 400, height: 400 });

    const confirm = document.createElement("button");
    confirm.setAttribute("data-magnetic", "");
    document.body.appendChild(confirm);
    mockRect(confirm, { left: 200, top: 200, width: 40, height: 40 });

    const cancel = document.createElement("button");
    cancel.setAttribute("data-magnetic", "");
    document.body.appendChild(cancel);
    mockRect(cancel, { left: 250, top: 200, width: 40, height: 40 });

    document.elementsFromPoint = ((x: number, y: number) => {
      if (x >= 200 && x <= 240 && y >= 200 && y <= 240) return [confirm, card];
      if (x >= 250 && x <= 290 && y >= 200 && y <= 240) return [cancel, card];
      return [card];
    }) as typeof document.elementsFromPoint;

    expect(nearestMagneticTarget(220, 220)?.width).toBe(40);
    expect(nearestMagneticTarget(270, 220)?.width).toBe(40);
    expect(nearestMagneticTarget(220, 220)?.x).not.toBe(
      nearestMagneticTarget(270, 220)?.x,
    );
  });

  it("on geometric ties prefers the smaller magnetic node", () => {
    document.elementsFromPoint = (() => []) as typeof document.elementsFromPoint;

    const card = document.createElement("article");
    card.setAttribute("data-magnetic", "");
    document.body.appendChild(card);
    mockRect(card, { left: 0, top: 0, width: 400, height: 400 });

    const confirm = document.createElement("button");
    confirm.setAttribute("data-magnetic", "");
    document.body.appendChild(confirm);
    mockRect(confirm, { left: 180, top: 180, width: 40, height: 40 });

    expect(nearestMagneticTarget(200, 200)?.width).toBe(40);
  });
});
