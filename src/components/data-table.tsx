"use client";

import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  type TableCellProps
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { Fragment, useDeferredValue, useMemo, useState, type ReactNode } from "react";
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
  /** Show a search box and filter rows client-side. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Text searched per row. Defaults to the row's primitive field values. */
  getSearchText?: (row: T) => string;
  /** Bucket rows under collapsible group headers. Omit for a flat table. */
  groupBy?: (row: T) => string;
  /** Order group keys (default: first-seen order). */
  groupOrder?: (a: string, b: string) => number;
  /** Custom group-header content; defaults to the key + a count chip. */
  renderGroupHeader?: (key: string, rows: T[]) => ReactNode;
}

/** Concatenate a row's primitive (and one-level-nested) values for free-text
 *  search when no explicit `getSearchText` is supplied. */
function defaultSearchText(row: unknown): string {
  if (row == null) return "";
  if (typeof row !== "object") return String(row).toLowerCase();
  const parts: string[] = [];
  const pushPrimitive = (v: unknown) => {
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") parts.push(String(v));
  };
  for (const v of Object.values(row as Record<string, unknown>)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === "object") Object.values(item).forEach(pushPrimitive);
        else pushPrimitive(item);
      }
    } else if (typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(pushPrimitive);
    } else {
      pushPrimitive(v);
    }
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Generic table with optional per-row actions, optional client-side search,
 * and optional collapsible grouping. With neither `searchable` nor `groupBy`
 * set, it renders a plain flat table just like before.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowActions,
  empty,
  size = "small",
  hover = true,
  searchable = false,
  searchPlaceholder,
  getSearchText,
  groupBy,
  groupOrder,
  renderGroupHeader
}: DataTableProps<T>): JSX.Element {
  const fullSpan = columns.length + (rowActions ? 1 : 0);
  // Collapsed groups keyed by group STRING in state, so they survive the
  // every-5s `rows` ref change (we never key collapse off row indices).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredRows = useMemo(() => {
    if (!searchable) return rows;
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return rows;
    const textOf = getSearchText
      ? (r: T) => getSearchText(r).toLowerCase()
      : (r: T) => defaultSearchText(r);
    return rows.filter((r) => textOf(r).includes(q));
  }, [rows, searchable, deferredQuery, getSearchText]);

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, T[]>();
    for (const row of filteredRows) {
      const key = groupBy(row);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    let keys = Array.from(map.keys());
    if (groupOrder) keys = keys.sort(groupOrder);
    return { map, keys };
  }, [filteredRows, groupBy, groupOrder]);

  const toggle = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allCollapsed = !!groups && groups.keys.every((k) => collapsedGroups.has(k));
  const setAll = (collapsed: boolean) =>
    setCollapsedGroups(collapsed && groups ? new Set(groups.keys) : new Set());

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

  const noMatches = rows.length > 0 && filteredRows.length === 0;
  const emptyRow = (
    <TableRow>
      <TableCell colSpan={fullSpan}>
        {noMatches ? (
          <EmptyState dense title="No matches" message="Nothing matches your search." />
        ) : (
          empty ?? <EmptyState dense />
        )}
      </TableCell>
    </TableRow>
  );

  let body: ReactNode;
  if (!groups) {
    body = filteredRows.length === 0 ? emptyRow : filteredRows.map(renderRow);
  } else if (filteredRows.length === 0) {
    body = emptyRow;
  } else {
    body = groups.keys.map((key) => {
      const groupRows = groups.map.get(key) ?? [];
      const isCollapsed = collapsedGroups.has(key);
      return (
        <Fragment key={`__group_${key}`}>
          <TableRow hover sx={{ cursor: "pointer", bgcolor: "action.hover" }} onClick={() => toggle(key)}>
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
    });
  }

  const showToolbar = searchable || (!!groups && groups.keys.length > 1);

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {showToolbar && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}
        >
          {searchable && (
            <TextField
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? "Search…"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
              sx={{ width: { xs: "100%", sm: 300 } }}
            />
          )}
          <Box sx={{ flex: 1 }} />
          {searchable && deferredQuery.trim() && (
            <Typography variant="caption" color="text.secondary">
              {filteredRows.length} of {rows.length}
            </Typography>
          )}
          {groups && groups.keys.length > 1 && (
            <Chip
              size="small"
              variant="outlined"
              icon={allCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
              label={allCollapsed ? "Expand all" : "Collapse all"}
              onClick={() => setAll(!allCollapsed)}
            />
          )}
        </Stack>
      )}
      <Box sx={{ overflowX: "auto" }}>
        <Table size={size}>
          {head}
          <TableBody>{body}</TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
