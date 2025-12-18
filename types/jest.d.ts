/**
 * Jest type declarations
 * This file provides type definitions for Jest globals when @types/jest is not installed
 */

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare const expect: {
  <T = any>(value: T): {
    toBe: (expected: T) => void;
    toEqual: (expected: T) => void;
    toThrow: (expected?: any) => void;
    not: {
      toThrow: () => void;
      toBe: (expected: T) => void;
      toEqual: (expected: T) => void;
    };
    toHaveLength: (length: number) => void;
    toBeInstanceOf: (constructor: any) => void;
  };
};

