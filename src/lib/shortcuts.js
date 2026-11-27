/**
 * Shared keyboard-first shortcuts, nav hotkey mapping, barcode burst detector,
 * and form field Enter-navigation helpers.
 */

export const POS_SHORTCUTS = [
  { key: "F1", label: "Shortcuts Help", scope: "Global" },
  { key: "F2", label: "New Sale / Clear Bill", scope: "POS" },
  { key: "F3", label: "Focus Search / Barcode", scope: "POS & Lists" },
  { key: "F4", label: "Customer / Patient", scope: "POS" },
  { key: "F5", label: "Hold / Resume Bill", scope: "POS" },
  { key: "F6", label: "Discount Field", scope: "POS" },
  { key: "F8", label: "Cycle Payment Method", scope: "POS" },
  { key: "F9", label: "Save & Print Receipt", scope: "POS" },
  { key: "F10", label: "Save Bill Only", scope: "POS" },
  { key: "↑ / ↓", label: "Navigate Search Results", scope: "POS & Tables" },
  { key: "Enter", label: "Add Item / Next Field", scope: "POS & Forms" },
  { key: "Ctrl+Del", label: "Remove Selected Item", scope: "POS Cart" },
  { key: "Ctrl+Z", label: "Undo Last Cart Action", scope: "POS Cart" },
  { key: "Esc", label: "Close / Clear / Cancel", scope: "Global" },
  { key: "Alt+1..9", label: "Switch Allowed Pages", scope: "Global" },
];

export const LAB_SHORTCUTS = [
  { key: "F3", label: "Focus List Search" },
  { key: "Enter", label: "Next Parameter / Save Last Field" },
  { key: "Ctrl+Enter", label: "Submit Active Form / Save Result" },
  { key: "F9 / Ctrl+P", label: "Print Report / Invoice" },
];

/**
 * Extracts ordered unique top-level navigation targets from role-filtered sidebar nav
 * so Alt+1..9 only opens routes permitted for the current user.
 */
export function flattenNavLinks(nav = []) {
  const seen = new Set();
  const out = [];

  for (const item of nav) {
    if (!item || item.section) continue;
    if (typeof item.href === "string" && item.href && !seen.has(item.href)) {
      seen.add(item.href);
      out.push({ href: item.href, label: item.label || item.href });
    }
    if (Array.isArray(item.children)) {
      for (const child of item.children) {
        if (typeof child?.href === "string" && child.href && !seen.has(child.href)) {
          seen.add(child.href);
          out.push({ href: child.href, label: child.label || item.group || child.href });
        }
      }
    }
    if (out.length >= 9) break;
  }

  return out.slice(0, 9);
}

/**
 * Detects rapid hardware barcode scanner bursts (typically < 45ms between keys)
 * so barcode Enter can auto-add and keep focus ready for the next scan.
 */
export function createScannerDetector() {
  let lastKeyAt = 0;
  let fastChars = 0;

  return {
    recordKey(key) {
      const now = performance.now();
      if (key.length === 1) {
        if (lastKeyAt && now - lastKeyAt <= 55) {
          fastChars += 1;
        } else {
          fastChars = 1;
        }
        lastKeyAt = now;
      } else if (key !== "Shift" && key !== "Enter") {
        fastChars = 0;
        lastKeyAt = 0;
      }
    },
    consumeScanEnter() {
      const now = performance.now();
      const isScan = fastChars >= 4 && now - lastKeyAt <= 120;
      fastChars = 0;
      lastKeyAt = 0;
      return isScan;
    },
    reset() {
      fastChars = 0;
      lastKeyAt = 0;
    },
  };
}

/**
 * Moves focus to the next focusable input/select inside a container on Enter.
 * Returns true if moved, false if currently on the final field (caller may submit).
 */
export function advanceFocusOnEnter(event, container, selector = "input:not([disabled]):not([type='hidden']), select:not([disabled])") {
  if (!container || event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey) return false;
  const tag = event.target?.tagName;
  if (tag === "TEXTAREA" || tag === "BUTTON" || event.target?.type === "submit") return false;

  const nodes = Array.from(container.querySelectorAll(selector)).filter(
    (el) => el.offsetParent !== null && el.tabIndex !== -1,
  );
  const idx = nodes.indexOf(event.target);
  if (idx >= 0 && idx < nodes.length - 1) {
    event.preventDefault();
    const next = nodes[idx + 1];
    next.focus();
    if (typeof next.select === "function" && ["text", "number", "search", "tel"].includes(next.type)) {
      try {
        next.select();
      } catch {
        /* ignore */
      }
    }
    return true;
  }
  return false;
}
