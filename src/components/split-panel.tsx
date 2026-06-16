"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {
  MIN_BOTTOM,
  STEP_PAGE,
  STEP_SINGLE,
  defaultBottomSize,
  getLimitedValue,
  maxBottomSize
} from "./split-panel-constants";

export interface SplitPanelProps {
  /** The docked panel's body (e.g. a log stream). */
  panel: ReactNode;
  /** Panel title shown in its header bar. */
  header?: ReactNode;
  /** Extra controls rendered on the right of the header. */
  headerActions?: ReactNode;
  /** Accessible label for the resize handle. */
  ariaLabel?: string;
  /** Collapsed to a thin rail (controlled by the page so it can pause streams). */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Close the panel entirely. */
  onClose?: () => void;
  /** localStorage suffix: dgui.v2.splitpanel.<storageKey>. */
  storageKey?: string;
}

const DIVIDER_H = 18;
const RAIL_H = 44;

interface PersistShape {
  size: number;
  collapsed: boolean;
}

/**
 * Hand-rolled bottom-dock resizable panel modelled on the AWS Cloudscape
 * SplitPanel. Rendered as a fixed-height flex sibling under PageShell's
 * (overflow:auto) content area, so growing it reflows/shrinks the content above
 * rather than overlaying it — the real AWS behaviour.
 *
 * Drag the divider (pointer-captured, rAF-throttled) or use the keyboard
 * (Arrow ±10, PageUp/Down ±60, Home=max, End=min). Double-click the divider or
 * click the chevron toggles collapse to a thin rail. Size + collapsed state
 * persist to localStorage, read only after mount and re-clamped to the live
 * viewport so a panel saved tall on a big screen never overflows a small one.
 */
export function SplitPanel({
  panel,
  header,
  headerActions,
  ariaLabel = "Resize panel",
  collapsed = false,
  onCollapsedChange,
  onClose,
  storageKey
}: SplitPanelProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number>(280);
  const [isResizing, setIsResizing] = useState(false);
  const rafRef = useRef<number | null>(null);
  const restoredCollapsed = useRef(false);

  /** Height available to the whole main column (panel reflows content above). */
  const availableHeight = useCallback(
    () => rootRef.current?.parentElement?.clientHeight ?? 560,
    []
  );

  const clampToViewport = useCallback(
    (value: number): number => getLimitedValue(MIN_BOTTOM, value, maxBottomSize(availableHeight())),
    [availableHeight]
  );

  const persist = useCallback(
    (next: Partial<PersistShape>) => {
      if (!storageKey || typeof window === "undefined") return;
      try {
        const key = `dgui.v2.splitpanel.${storageKey}`;
        const prev = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Partial<PersistShape>;
        window.localStorage.setItem(key, JSON.stringify({ ...prev, ...next }));
      } catch {
        /* ignore quota / serialization errors */
      }
    },
    [storageKey]
  );

  // Restore persisted size/collapsed AFTER mount, clamped to the live height.
  useEffect(() => {
    const h = availableHeight();
    let restored: Partial<PersistShape> = {};
    if (storageKey && typeof window !== "undefined") {
      try {
        restored = JSON.parse(
          window.localStorage.getItem(`dgui.v2.splitpanel.${storageKey}`) ?? "{}"
        ) as Partial<PersistShape>;
      } catch {
        restored = {};
      }
    }
    const base = typeof restored.size === "number" ? restored.size : defaultBottomSize(h);
    setSize(getLimitedValue(MIN_BOTTOM, base, maxBottomSize(h)));
    if (typeof restored.collapsed === "boolean" && restored.collapsed && !restoredCollapsed.current) {
      restoredCollapsed.current = true;
      onCollapsedChange?.(true);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the size valid when the viewport changes.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const el = rootRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(() => setSize((s) => clampToViewport(s)));
    obs.observe(el);
    return () => obs.disconnect();
  }, [clampToViewport]);

  const applySize = useCallback(
    (next: number) => {
      const clamped = clampToViewport(next);
      setSize(clamped);
      return clamped;
    },
    [clampToViewport]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      // Panel height = distance from the pointer to the bottom of the panel.
      const next = rect.bottom - e.clientY - DIVIDER_H / 2;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => applySize(next));
    },
    [isResizing, applySize]
  );

  const endResize = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      setIsResizing(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      persist({ size });
    },
    [isResizing, persist, size]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (collapsed) return;
      e.preventDefault();
      setIsResizing(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* unsupported */
      }
    },
    [collapsed]
  );

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    onCollapsedChange?.(next);
    persist({ collapsed: next });
  }, [collapsed, onCollapsedChange, persist]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (collapsed) return;
      let next: number | null = null;
      switch (e.key) {
        case "ArrowUp":
          next = size + STEP_SINGLE;
          break;
        case "ArrowDown":
          next = size - STEP_SINGLE;
          break;
        case "PageUp":
          next = size + STEP_PAGE;
          break;
        case "PageDown":
          next = size - STEP_PAGE;
          break;
        case "Home":
          next = maxBottomSize(availableHeight());
          break;
        case "End":
          next = MIN_BOTTOM;
          break;
        default:
          return;
      }
      e.preventDefault();
      persist({ size: applySize(next) });
    },
    [collapsed, size, applySize, persist, availableHeight]
  );

  return (
    <Box
      ref={rootRef}
      sx={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        boxShadow: "0 -2px 8px rgba(15,23,42,0.06)",
        zIndex: 2
      }}
    >
      {/* Resize handle (hidden when collapsed) */}
      {!collapsed && (
        <Box
          role="separator"
          aria-orientation="horizontal"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onLostPointerCapture={endResize}
          onDoubleClick={toggleCollapsed}
          onKeyDown={onKeyDown}
          sx={{
            height: DIVIDER_H,
            flexShrink: 0,
            cursor: "ns-resize",
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderTop: 1,
            borderColor: "divider",
            color: "text.disabled",
            transition: "background-color 120ms, color 120ms",
            "&:hover": { bgcolor: "action.hover", color: "primary.main" },
            // Keyboard focus shows a subtle tint, no outline ring.
            "&:focus-visible": { bgcolor: "action.hover", color: "primary.main", outline: "none" },
            ...(isResizing ? { bgcolor: "action.selected", color: "primary.main" } : {})
          }}
        >
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "currentColor", opacity: 0.5 }} />
        </Box>
      )}

      {/* Panel header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 2,
          height: RAIL_H,
          flexShrink: 0,
          borderTop: collapsed ? 1 : 0,
          borderColor: "divider"
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {typeof header === "string" ? (
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
              {header}
            </Typography>
          ) : (
            header
          )}
        </Box>
        {!collapsed && headerActions}
        <Tooltip title={collapsed ? "Expand" : "Collapse"}>
          <IconButton size="small" onClick={toggleCollapsed}>
            {collapsed ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        {onClose && (
          <Tooltip title="Close">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Panel body — sized by `size`, hidden during an active drag so its
          (potentially large) content doesn't reflow on every pointermove. */}
      {!collapsed && (
        <Box
          sx={{
            height: size,
            flexShrink: 0,
            minHeight: 0,
            overflow: "hidden",
            ...(isResizing ? { visibility: "hidden" } : {})
          }}
        >
          {panel}
        </Box>
      )}
    </Box>
  );
}
