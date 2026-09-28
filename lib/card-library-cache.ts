import type { Card } from "@/types/card";

const DB_NAME = "mda-card-library";
const DB_VERSION = 1;
const STORE_NAME = "library";
const CACHE_KEY = "all-cards";
/** Bump when Card shape or fetch mapping changes. */
export const CARD_LIBRARY_CACHE_SCHEMA = 3;
/** Revalidate from network after this age. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CardLibraryCacheRecord = {
  key: string;
  schema: number;
  savedAt: number;
  cards: Card[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (): void => {
      reject(request.error ?? new Error("Failed to open card library DB"));
    };
    request.onsuccess = (): void => {
      resolve(request.result);
    };
    request.onupgradeneeded = (): void => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

function isFresh(savedAt: number): boolean {
  return Date.now() - savedAt < CACHE_TTL_MS;
}

/** Read a valid, non-expired card library snapshot from IndexedDB. */
export async function readCardLibraryCache(): Promise<Card[] | null> {
  try {
    const db = await openDb();
    const record = await new Promise<CardLibraryCacheRecord | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(CACHE_KEY);
        request.onsuccess = (): void => {
          resolve(request.result as CardLibraryCacheRecord | undefined);
        };
        request.onerror = (): void => {
          reject(request.error ?? new Error("Failed to read card library cache"));
        };
      },
    );
    db.close();

    if (!record) return null;
    if (record.schema !== CARD_LIBRARY_CACHE_SCHEMA) return null;
    if (!Array.isArray(record.cards) || record.cards.length === 0) return null;
    if (!isFresh(record.savedAt)) return null;
    return record.cards;
  } catch {
    return null;
  }
}

/** Persist the full card library for subsequent sessions. */
export async function writeCardLibraryCache(cards: Card[]): Promise<void> {
  if (cards.length === 0) return;
  try {
    const db = await openDb();
    const record: CardLibraryCacheRecord = {
      key: CACHE_KEY,
      schema: CARD_LIBRARY_CACHE_SCHEMA,
      savedAt: Date.now(),
      cards,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = (): void => resolve();
      tx.onerror = (): void => {
        reject(tx.error ?? new Error("Failed to write card library cache"));
      };
      tx.objectStore(STORE_NAME).put(record);
    });
    db.close();
  } catch {
    // Cache write is best-effort — network fetch still succeeded.
  }
}
