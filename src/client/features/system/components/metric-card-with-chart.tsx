"use client";

import { ReactNode, useState } from "react";
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface MetricCardWithChartProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  chartData: Array<{ timestamp: string; value: number }>;
  color?: string;
  onClick?: () => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  height: "100%",
  transition: "transform 0.2s, box-shadow 0.2s",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: theme.shadows[4]
  }
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 48,
  height: 48,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === "dark" ? "rgba(56, 189, 248, 0.12)" : theme.palette.primary.light,
  color: theme.palette.primary.main
}));

const MetricCardWithChart = ({
  title,
  value,
  subtitle,
  icon,
  chartData,
  color,
  onClick
}: MetricCardWithChartProps) => {
  const theme = useTheme();
  const [showInfo] = useState(false);
  const chartColor = color || theme.palette.primary.main;

  const content = (
    <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box flex={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" color="text.secondary">
              {title}
            </Typography>
            {onClick && <InfoOutlinedIcon fontSize="small" color="action" />}
          </Stack>
          <Typography variant="h4" sx={{ mt: 1, mb: 0.5 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {icon && <IconWrapper>{icon}</IconWrapper>}
      </Stack>

      <Box sx={{ height: 80, width: "100%" }}>
        <ResponsiveContainer>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="timestamp" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: theme.shape.borderRadius
              }}
              formatter={(value: number) => [value.toFixed(1), title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </CardContent>
  );

  if (onClick) {
    return (
      <StyledCard>
        <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
          {content}
        </CardActionArea>
      </StyledCard>
    );
  }

  return <StyledCard>{content}</StyledCard>;
};

export default MetricCardWithChart;

