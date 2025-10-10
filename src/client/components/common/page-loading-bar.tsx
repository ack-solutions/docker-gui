"use client";

import { useTheme } from "@mui/material/styles";
import NextTopLoader from "nextjs-toploader";

const PageLoadingBar = () => {
  const theme = useTheme();
  const color = theme.palette.primary.main;

  return (
    <NextTopLoader
      color={color}
      height={3}
      showSpinner={false}
      speed={200}
      shadow={`0 0 10px ${color},0 0 5px ${color}`}
      crawlSpeed={200}
      initialPosition={0.08}
      easing="ease"
    />
  );
};

export default PageLoadingBar;

