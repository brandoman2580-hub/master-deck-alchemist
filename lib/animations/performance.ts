/**
 * Check if device is low-end based on hardware concurrency
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  // Check hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency || 4;
  const isLowEnd = cores < 4;

  // Check connection speed (if available)
  if ("connection" in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === "slow-2g" || effectiveType === "2g") {
        return true;
      }
    }
  }

  return isLowEnd;
}

/**
 * Get optimal animation duration based on device performance
 */
export function getOptimalDuration(
  baseDuration: number,
  multiplier: number = 1,
): number {
  if (isLowEndDevice()) {
    // Reduce duration on low-end devices for better performance
    return baseDuration * 0.7 * multiplier;
  }
  return baseDuration * multiplier;
}

/**
 * Manage will-change property for performance
 * Adds will-change when animation starts, removes when complete
 */
export function manageWillChange(
  element: HTMLElement,
  property: string = "transform",
) {
  if (!element) return;

  const cleanup = () => {
    element.style.willChange = "";
  };

  // Add will-change
  element.style.willChange = property;

  // Remove will-change after animation (estimate 300ms)
  const timeout = setTimeout(cleanup, 300);

  return () => {
    clearTimeout(timeout);
    cleanup();
  };
}

/**
 * Throttle animation updates for performance
 */
export function throttleAnimation<T extends (...args: any[]) => void>(
  func: T,
  delay: number = 16, // ~60fps
): T {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func(...args);
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - timeSinceLastCall);
    }
  }) as T;
}

/**
 * Debounce animation updates for performance
 */
export function debounceAnimation<T extends (...args: any[]) => void>(
  func: T,
  delay: number = 100,
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  }) as T;
}

/**
 * Check if animation should be disabled for performance
 */
export function shouldDisableAnimation(): boolean {
  // Check for reduced motion
  if (typeof window !== "undefined") {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return true;
    }
  }

  // Check for low-end device
  if (isLowEndDevice()) {
    // Optionally disable heavy animations on low-end devices
    // For now, we'll keep them but with reduced duration
    return false;
  }

  return false;
}

/**
 * Get performance-optimized animation config
 */
export function getPerformanceOptimizedConfig(
  baseDuration: number,
  baseEasing: number[],
) {
  const prefersReducedMotion = shouldDisableAnimation();
  const isLowEnd = isLowEndDevice();

  if (prefersReducedMotion) {
    return {
      duration: 0,
      ease: baseEasing,
    };
  }

  return {
    duration: isLowEnd ? getOptimalDuration(baseDuration, 0.7) : baseDuration,
    ease: baseEasing,
  };
}

/**
 * Monitor FPS during animation
 */
export class FPSMonitor {
  private frames: number[] = [];
  private lastTime: number = performance.now();
  private frameCount: number = 0;
  private isMonitoring: boolean = false;

  start(): void {
    this.isMonitoring = true;
    this.frames = [];
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.measure();
  }

  stop(): number {
    this.isMonitoring = false;
    if (this.frames.length === 0) return 60;

    const average =
      this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    return Math.round(average);
  }

  private measure = (): void => {
    if (!this.isMonitoring) return;

    this.frameCount++;
    const currentTime = performance.now();

    if (currentTime >= this.lastTime + 1000) {
      const fps = this.frameCount;
      this.frames.push(fps);
      this.frameCount = 0;
      this.lastTime = currentTime;

      // Keep only last 10 measurements
      if (this.frames.length > 10) {
        this.frames.shift();
      }
    }

    requestAnimationFrame(this.measure);
  };
}

