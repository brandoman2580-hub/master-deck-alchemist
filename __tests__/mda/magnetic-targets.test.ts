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
  afterEach(() => {
    document.body.innerHTML = "";
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
    background.setAttribute("data-testid", "background");
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
    mockRect(confirm, { left: 300, top: 300, width: 40, height: 40 });

    expect(getMagneticSearchRoot()).toBe(popover);
    expect(nearestMagneticTarget(40, 40)).toBeNull();
    expect(nearestMagneticTarget(310, 310)?.width).toBe(40);
  });
});
