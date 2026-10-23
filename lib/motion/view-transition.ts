/**
 * Crossfades Workshop and Archives with the View Transitions API.
 * Reduced motion, and browsers without the API, navigate immediately.
 * The destination page focuses `[data-page-heading]` when this flag is set.
 */

let focusHeading = false;

type StartViewTransition = (callback: () => void | Promise<void>) => {
  finished: Promise<void>;
  ready: Promise<void>;
};

export function navigateWithViewTransition(push: () => void): void {
  focusHeading = true;
  const clearFocus = () => {
    focusHeading = false;
  };

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = (
    document as Document & { startViewTransition?: StartViewTransition }
  ).startViewTransition?.bind(document);

  if (reduced || !start) {
    push();
    window.setTimeout(clearFocus, 2000);
    return;
  }

  try {
    const transition = start(async () => {
      const ready = waitForPageReady(2000);
      push();
      await ready;
    });
    // A skipped or aborted transition rejects. Swallow it so Next's overlay
    // does not surface the browser timeout.
    void transition.ready?.catch(() => {});
    void transition.finished.catch(() => {});
    void transition.finished.finally(clearFocus);
  } catch {
    push();
    window.setTimeout(clearFocus, 2000);
  }
}

export function takeRouteFocus(): boolean {
  return focusHeading;
}

export function signalPageReady(): void {
  window.dispatchEvent(new Event("mda-page-ready"));
}

function waitForPageReady(timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      window.removeEventListener("mda-page-ready", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    window.addEventListener("mda-page-ready", finish);
  });
}
