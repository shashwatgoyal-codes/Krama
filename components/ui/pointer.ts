"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the reader is pointing with a finger.
 *
 * Read through useSyncExternalStore rather than an effect: the server has
 * no way to know, and setting state in an effect to find out costs a
 * second render on every mount of every field. This subscribes to the
 * media query instead, so it is correct after hydration and updates if
 * the answer changes — which it does when a tablet keyboard is attached.
 *
 * The server snapshot is false, meaning "assume a mouse". The custom
 * picker is the one that matches the app, so it is the one worth
 * rendering first; a touch device swaps to the native control on its
 * first paint, and swapping towards the OS control is the harmless
 * direction to be briefly wrong in.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}
