/**
 * Single barrel for the component library.
 *
 * Pages should import from `@/components` only — never reach into
 * individual files. This keeps refactors localized and the public surface
 * obvious from one place.
 */
export { theme, toneFor, progressColor } from "./theme";
export type { StatusKind, Tone } from "./theme";

export {
  formatBytes,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  formatPorts
} from "./format";

export { StatusChip } from "./status-chip";
export type { StatusChipProps } from "./status-chip";

export { MetricBar } from "./metric-bar";
export type { MetricBarProps } from "./metric-bar";

export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";

export { ErrorState } from "./error-state";
export type { ErrorStateProps } from "./error-state";

export { LoadingState } from "./loading-state";
export type { LoadingStateProps } from "./loading-state";

export { SectionCard } from "./section-card";
export type { SectionCardProps } from "./section-card";

export { DataTable } from "./data-table";
export type { Column, DataTableProps } from "./data-table";

export { PageShell } from "./page-shell";
export type { PageShellProps, NavItem } from "./page-shell";

export { SplitPanel } from "./split-panel";
export type { SplitPanelProps } from "./split-panel";

export { LogStreamPanel } from "./log-stream-panel";
export type { LogStreamPanelProps } from "./log-stream-panel";

export { AuthGuard } from "./auth-guard";
export type { AuthGuardProps } from "./auth-guard";
