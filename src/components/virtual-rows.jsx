"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight zero-dependency virtualized row list so POS search tables
 * stay 60fps even with thousands of catalog entries.
 */
export default function VirtualRows({
  items = [],
  rowHeight = 46,
  overscan = 5,
  scrollToIndex = -1,
  className = "",
  empty = null,
  renderRow,
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(360);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el.clientHeight > 0) setViewportHeight(el.clientHeight);
    };
    updateHeight();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || scrollToIndex < 0 || scrollToIndex >= items.length) return;
    const itemTop = scrollToIndex * rowHeight;
    const itemBottom = itemTop + rowHeight;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;
    if (itemTop < viewTop) {
      el.scrollTop = itemTop;
    } else if (itemBottom > viewBottom) {
      el.scrollTop = Math.max(0, itemBottom - el.clientHeight);
    }
  }, [scrollToIndex, rowHeight, items.length]);

  if (!items.length) {
    return (
      <div ref={containerRef} className={`min-h-0 flex-1 overflow-y-auto ${className}`}>
        {empty}
      </div>
    );
  }

  const totalHeight = items.length * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const end = Math.min(items.length, start + visibleCount);

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={`min-h-0 flex-1 overflow-y-auto ${className}`}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {items.slice(start, end).map((item, offset) => {
          const idx = start + offset;
          return (
            <div
              key={item.id || idx}
              style={{
                position: "absolute",
                top: idx * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
              }}
            >
              {renderRow(item, idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
