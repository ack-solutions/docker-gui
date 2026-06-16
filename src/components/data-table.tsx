"use client";

import {
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  type TableCellProps
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: TableCellProps["align"];
  width?: number | string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowActions?: (row: T) => ReactNode;
  empty?: ReactNode;
  size?: "small" | "medium";
  hover?: boolean;
  /** Bucket rows under collapsible group headers. Omit for a flat table. */
  groupBy?: (row: T) => string;
  /** Order group keys (default: first-seen order). */
  groupOrder?: (a: string, b: string) => number;
  /** Custom group-header content; defaults to the key + a count chip. */
  renderGroupHeader?: (key: string, rows: T[]) => ReactNode;
}

/**
 * Generic table with optional per-row actions and optional collapsible
 * grouping. When `groupBy` is omitted the original flat render path runs
 * unchanged, so existing call sites are unaffected.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowActions,
  empty,
  size = "small",
  hover = true,
  groupBy,
  groupOrder,
  renderGroupHeader
}: DataTableProps<T>): JSX.Element {
  const fullSpan = columns.length + (rowActions ? 1 : 0);
  // Collapsed groups keyed by group STRING in state, so they survive the
  // every-5s `rows` ref change (we never key collapse off row indices).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Bucket rows preserving first-seen order; only recomputed when inputs change.
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const key = groupBy(row);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    let keys = Array.from(map.keys());
    if (groupOrder) keys = keys.sort(groupOrder);
    return { map, keys };
  }, [rows, groupBy, groupOrder]);

  const head = (
    <TableHead>
      <TableRow>
        {columns.map((c) => (
          <TableCell
            key={c.key}
            {...(c.align ? { align: c.align } : {})}
            {...(c.width !== undefined ? { sx: { width: c.width } } : {})}
          >
            {c.header}
          </TableCell>
        ))}
        {rowActions && <TableCell align="right">Actions</TableCell>}
      </TableRow>
    </TableHead>
  );

  const renderRow = (row: T) => (
    <TableRow key={rowKey(row)} hover={hover}>
      {columns.map((c) => (
        <TableCell key={c.key} {...(c.align ? { align: c.align } : {})}>
          {c.render(row)}
        </TableCell>
      ))}
      {rowActions && <TableCell align="right">{rowActions(row)}</TableCell>}
    </TableRow>
  );

  const emptyRow = (
    <TableRow>
      <TableCell colSpan={fullSpan}>{empty ?? <EmptyState dense />}</TableCell>
    </TableRow>
  );

  // ---- Flat path (unchanged behaviour) ----
  if (!groups) {
    return (
      <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size={size}>
          {head}
          <TableBody>{rows.length === 0 ? emptyRow : rows.map(renderRow)}</TableBody>
        </Table>
      </Paper>
    );
  }

  // ---- Grouped path ----
  if (rows.length === 0) {
    return (
      <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size={size}>
          {head}
          <TableBody>{emptyRow}</TableBody>
        </Table>
      </Paper>
    );
  }

  const toggle = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allCollapsed = groups.keys.every((k) => collapsedGroups.has(k));
  const setAll = (collapsed: boolean) =>
    setCollapsedGroups(collapsed ? new Set(groups.keys) : new Set());

  return (
    <Paper variant="outlined" sx={{ overflowX: "auto" }}>
      {groups.keys.length > 1 && (
        <Stack direction="row" justifyContent="flex-end" sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: "divider" }}>
          <Chip
            size="small"
            variant="outlined"
            icon={allCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
            label={allCollapsed ? "Expand all" : "Collapse all"}
            onClick={() => setAll(!allCollapsed)}
          />
        </Stack>
      )}
      <Table size={size}>
        {head}
        <TableBody>
          {groups.keys.map((key) => {
            const groupRows = groups.map.get(key) ?? [];
            const isCollapsed = collapsedGroups.has(key);
            return (
              <Fragment key={`__group_${key}`}>
                <TableRow
                  hover
                  sx={{ cursor: "pointer", bgcolor: "action.hover" }}
                  onClick={() => toggle(key)}
                >
                  <TableCell colSpan={fullSpan} sx={{ py: 0.75 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <IconButton
                        size="small"
                        aria-label={isCollapsed ? "Expand group" : "Collapse group"}
                        aria-expanded={!isCollapsed}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(key);
                        }}
                      >
                        {isCollapsed ? (
                          <KeyboardArrowRightIcon fontSize="small" />
                        ) : (
                          <KeyboardArrowDownIcon fontSize="small" />
                        )}
                      </IconButton>
                      {renderGroupHeader ? (
                        renderGroupHeader(key, groupRows)
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {key}
                        </Typography>
                      )}
                      <Box sx={{ flex: 1 }} />
                      <Chip size="small" variant="outlined" label={groupRows.length} />
                    </Stack>
                  </TableCell>
                </TableRow>
                {!isCollapsed && groupRows.map(renderRow)}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}
