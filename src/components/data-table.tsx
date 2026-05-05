"use client";

import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  type TableCellProps
} from "@mui/material";
import type { ReactNode } from "react";
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
}

/**
 * Generic table with optional per-row actions column.
 *
 * The shape is the same everywhere: header row → optional empty state →
 * one row per item → optional actions cell on the right.
 *
 * Usage:
 *   const columns: Column<Container>[] = [
 *     { key: 'state', header: 'State', render: r => <StatusChip status={r.state} /> },
 *     { key: 'name',  header: 'Name',  render: r => r.names[0] ?? r.shortId },
 *   ];
 *   <DataTable columns={columns} rows={items} rowKey={r => r.id}
 *              rowActions={row => <ActionButtons row={row} />}
 *              empty={<EmptyState title="No containers" />} />
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowActions,
  empty,
  size = "small",
  hover = true
}: DataTableProps<T>): JSX.Element {
  return (
    <Paper variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size={size}>
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
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (rowActions ? 1 : 0)}>
                {empty ?? <EmptyState dense />}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={rowKey(row)} hover={hover}>
                {columns.map((c) => (
                  <TableCell key={c.key} {...(c.align ? { align: c.align } : {})}>
                    {c.render(row)}
                  </TableCell>
                ))}
                {rowActions && <TableCell align="right">{rowActions(row)}</TableCell>}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
