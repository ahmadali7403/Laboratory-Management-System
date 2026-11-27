"use client";

import { useCallback, useSyncExternalStore } from "react";

const THEME_KEY = "labos:pos-theme";
const listeners = new Set();

function subscribe(cb) {
  listeners.add(cb);
  const onStorage = (e) => {
    if (e.key === THEME_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function usePosTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light");
  const toggleTheme = useCallback(() => {
    const next = getSnapshot() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    listeners.forEach((cb) => cb());
  }, []);

  return { theme, isDark: theme === "dark", toggleTheme };
}
