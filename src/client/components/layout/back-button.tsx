"use client";

import { useRouter } from "next/navigation";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button } from "@mui/material";

interface BackButtonProps {
  label?: string;
  href?: string;
}

const BackButton = ({ label = "Back", href }: BackButtonProps) => {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <Button
      startIcon={<ArrowBackIcon />}
      onClick={handleClick}
      size="small"
      sx={{ mb: 2 }}
    >
      {label}
    </Button>
  );
};

export default BackButton;

