// Mock HTMLCanvasElement for jest-axe in jsdom
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
}

// Import jest-dom matchers for better assertions
require("@testing-library/jest-dom");

// Mock window.matchMedia for components that use it
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock crypto.randomUUID for Node.js test environment
if (typeof crypto === "undefined" || !crypto.randomUUID) {
  Object.defineProperty(global, "crypto", {
    value: {
      randomUUID: jest.fn(() => {
        // Generate a simple UUID v4 mock
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }),
    },
    writable: true,
  });
}

// Mock IntersectionObserver if not available
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver if not available
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock requestAnimationFrame and cancelAnimationFrame for tests
if (typeof global.requestAnimationFrame === "undefined") {
  global.requestAnimationFrame = jest.fn((cb) => {
    setTimeout(cb, 0);
    return 1;
  });
}

if (typeof global.cancelAnimationFrame === "undefined") {
  global.cancelAnimationFrame = jest.fn();
}

// Mock getBoundingClientRect to return sensible defaults
if (typeof Element.prototype.getBoundingClientRect === "undefined") {
  Element.prototype.getBoundingClientRect = jest.fn(function() {
    return {
      left: 0,
      top: 0,
      width: this.offsetWidth || 100,
      height: this.offsetHeight || 50,
      bottom: this.offsetHeight || 50,
      right: this.offsetWidth || 100,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    };
  });
}
