"use client";

import { ReactNode } from "react";
import { Box, Card, CardActionArea, CardContent, Stack, Typography, alpha } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";

interface MetricCardWithChartProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  chartData: Array<{ timestamp: string; value: number }>;
  color?: string;
  onClick?: () => void;
}

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
  const chartColor = color || theme.palette.primary.main;

  const content = (
    <CardContent sx={{ 
      height: "100%", 
      display: "flex", 
      flexDirection: "column",
      gap: theme.spacing(2)
    }}>
      {/* Header Section */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box flex={1}>
          <Typography 
            variant="subtitle2" 
            color="text.secondary"
            sx={{ mb: theme.spacing(1) }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700,
              mb: theme.spacing(0.5),
              color: "text.primary"
            }}
          >
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        
        {icon && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: theme.spacing(1),
              backgroundColor: alpha(chartColor, 0.1),
              color: chartColor,
              "& svg": {
                fontSize: 24
              }
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>

      {/* Chart Section */}
      <Box 
        sx={{ 
          height: 80, 
          width: "100%",
          mt: "auto"
        }}
      >
        <ResponsiveContainer>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`gradient-${title.replace(/\s/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
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
                borderRadius: theme.shape.borderRadius,
                padding: theme.spacing(1, 1.5),
                boxShadow: theme.shadows[2]
              }}
              labelStyle={{
                color: theme.palette.text.secondary,
                fontSize: theme.typography.caption.fontSize,
                marginBottom: theme.spacing(0.5)
              }}
              itemStyle={{
                color: theme.palette.text.primary,
                fontSize: theme.typography.body2.fontSize
              }}
              formatter={(value: number) => [`${value.toFixed(1)}`, title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#gradient-${title.replace(/\s/g, "-")})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </CardContent>
  );

  if (onClick) {
    return (
      <Card 
        sx={{ 
          height: "100%",
          transition: "all 0.2s ease-in-out",
          cursor: "pointer",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: theme.shadows[4],
            borderColor: alpha(chartColor, 0.5)
          }
        }}
      >
        <CardActionArea 
          onClick={onClick} 
          sx={{ 
            height: "100%",
            "& .MuiCardActionArea-focusHighlight": {
              background: alpha(chartColor, 0.05)
            }
          }}
        >
          {content}
        </CardActionArea>
      </Card>
    );
  }

  return (
    <Card sx={{ height: "100%" }}>
      {content}
    </Card>
  );
};

export default MetricCardWithChart;
