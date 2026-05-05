"use client";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  dense?: boolean;
}

/**
 * The single card style. Title row on top (optional action on the right),
 * content below. Use this whenever a page is divided into named sections so
 * spacing and typography match.
 *
 * Usage:
 *   <SectionCard title="Service checks">
 *     ...
 *   </SectionCard>
 */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  dense = false
}: SectionCardProps): JSX.Element {
  const hasHeader = Boolean(title || subtitle || action);
  return (
    <Card>
      <CardContent sx={{ p: dense ? 2 : 3, "&:last-child": { pb: dense ? 2 : 3 } }}>
        {hasHeader && (
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            sx={{ mb: 2, gap: 2 }}
          >
            <Box>
              {title && (
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
          </Stack>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
