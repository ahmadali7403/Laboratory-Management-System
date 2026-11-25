"use client";

import { useEffect } from "react";

// Keeps the session alive while the app is open (no more surprise sign-outs).
// Only a real 401 sends the person to the login page; network/server errors are ignored.
export default function SessionKeepAlive() {
  useEffect(() => {
    let stopped = false;
    async function ping() {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
        if (!stopped && res.status === 401) window.location.replace("/login");
      } catch {
        /* offline - try again later */
      }
    }
    const timer = setInterval(ping, 20 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
