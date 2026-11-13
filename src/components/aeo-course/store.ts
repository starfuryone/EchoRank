"use client";

// Course state in this browser only: lesson progress and the AEO plan
// worksheet. No account, no server calls, nothing sent anywhere.
//
// localStorage can be missing (privacy modes, blocked site data, previews) or
// throw on access, so every read and write is wrapped and an in-memory copy
// keeps the course working for the session either way. Components read through
// useSyncExternalStore: the server snapshot is the empty state, so SSR and
// hydration agree, and the stored state arrives right after.

import { useSyncExternalStore } from "react";
import { AEO_PROGRESS_KEY, AEO_WORKSHEET_KEY } from "@/lib/aeo-course";

type Listener = () => void;

export interface LocalStore<T> {
  get(): T;
  set(next: T): void;
  subscribe(fn: Listener): () => void;
  /** False when the last write could not reach localStorage. */
  persisted(): boolean;
  serverSnapshot: T;
}

function createLocalStore<T>(key: string, empty: T, valid: (v: unknown) => v is T): LocalStore<T> {
  let memory: T | undefined;
  let raw: string | null | undefined;
  let ok = true;
  const listeners = new Set<Listener>();

  const read = (): T => {
    let next: string | null = null;
    try {
      next = window.localStorage.getItem(key);
    } catch {
      return memory ?? empty;
    }
    if (next === raw && memory !== undefined) return memory;
    raw = next;
    try {
      const parsed: unknown = next ? JSON.parse(next) : empty;
      memory = valid(parsed) ? parsed : empty;
    } catch {
      memory = empty;
    }
    return memory;
  };

  return {
    get: () => (typeof window === "undefined" ? empty : read()),
    set(next: T) {
      memory = next;
      try {
        raw = JSON.stringify(next);
        window.localStorage.setItem(key, raw);
        ok = true;
      } catch {
        ok = false;
      }
      listeners.forEach((fn) => fn());
    },
    subscribe(fn: Listener) {
      listeners.add(fn);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) fn();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(fn);
        window.removeEventListener("storage", onStorage);
      };
    },
    persisted: () => ok,
    serverSnapshot: empty,
  };
}

export interface AeoProgress {
  done: string[];
  /** The lesson visited last, for "Resume where you left off". */
  last?: string;
}

const EMPTY_PROGRESS: AeoProgress = { done: [] };

export const progressStore = createLocalStore<AeoProgress>(
  AEO_PROGRESS_KEY,
  EMPTY_PROGRESS,
  (v): v is AeoProgress => !!v && typeof v === "object" && Array.isArray((v as AeoProgress).done),
);

export type AeoWorksheet = Record<string, string>;
const EMPTY_SHEET: AeoWorksheet = {};

export const worksheetStore = createLocalStore<AeoWorksheet>(
  AEO_WORKSHEET_KEY,
  EMPTY_SHEET,
  (v): v is AeoWorksheet => !!v && typeof v === "object" && !Array.isArray(v),
);

export function useStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.serverSnapshot);
}

/** True once mounted in a browser; false on the server and during hydration. */
const noop = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function setLessonDone(slug: string, done: boolean) {
  const p = progressStore.get();
  const set = new Set(p.done);
  if (done) set.add(slug);
  else set.delete(slug);
  progressStore.set({ ...p, done: [...set] });
}

export function recordVisit(slug: string) {
  const p = progressStore.get();
  if (p.last !== slug) progressStore.set({ ...p, last: slug });
}
