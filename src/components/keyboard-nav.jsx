"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShortcutsHelpModal } from "@/components/shortcut-bar";

/**
 * Provides role-gated Alt+1..9 navigation, global F1 shortcuts help dialog,
 * and F3 focus-search on non-POS list pages.
 */
export default function KeyboardNav({ navLinks = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  const isPos = pathname === "/pharmacy/pos" || pathname === "/orders/new";

  useEffect(() => {
    function openHelp() {
      setHelpOpen(true);
    }
    window.addEventListener("labos:help", openHelp);
    return () => window.removeEventListener("labos:help", openHelp);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "F1") {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      // Alt+1..9 quick navigation only to pages authorized for this user's role
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const num = Number(e.key);
        if (num >= 1 && num <= 9) {
          const target = navLinks[num - 1];
          if (target?.href) {
            e.preventDefault();
            router.push(target.href);
          }
          return;
        }
      }

      // F3 focuses the active screen's search field on list/report pages (POS handles F3 itself)
      if (!isPos && e.key === "F3") {
        const modalOpen = document.querySelector('[role="dialog"]');
        const root = modalOpen || document;
        const input =
          root.querySelector('input[data-search-input="true"]:not([disabled])') ||
          root.querySelector('input[placeholder*="Search" i]:not([disabled])');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select?.();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [navLinks, router, isPos]);

  return (
    <ShortcutsHelpModal
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      navLinks={navLinks}
    />
  );
}
