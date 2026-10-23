import { navigateWithViewTransition, takeRouteFocus } from "@/lib/motion/view-transition";

function setReducedMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

describe("navigateWithViewTransition", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    delete (document as Document & { startViewTransition?: unknown }).startViewTransition;
  });

  it("navigates immediately when the user prefers reduced motion", () => {
    jest.useFakeTimers();
    setReducedMotion(true);
    const start = jest.fn();
    (document as Document & { startViewTransition?: typeof start }).startViewTransition = start;
    const push = jest.fn();

    navigateWithViewTransition(push);

    expect(push).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(takeRouteFocus()).toBe(true);
    jest.useRealTimers();
  });

  it("crossfades through the View Transitions API and still navigates", async () => {
    setReducedMotion(false);
    const push = jest.fn();
    let update: (() => Promise<void>) | undefined;
    let finish = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const originalFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      callback(0);
      return 1;
    };
    (document as Document & {
      startViewTransition?: (callback: () => Promise<void>) => { finished: Promise<void> };
    }).startViewTransition = (callback) => {
      update = callback;
      return { finished };
    };

    navigateWithViewTransition(push);
    const pending = update?.();
    window.dispatchEvent(new Event("mda-page-ready"));
    await pending;
    window.requestAnimationFrame = originalFrame;
    finish();

    expect(push).toHaveBeenCalledTimes(1);
    expect(takeRouteFocus()).toBe(true);
  });
});
