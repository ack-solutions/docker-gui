"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HomeIcon from "@mui/icons-material/Home";
import { Breadcrumbs, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

const BreadcrumbLink = styled("a")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  textDecoration: "none",
  color: theme.palette.text.secondary,
  fontSize: theme.typography.body2.fontSize,
  "&:hover": {
    color: theme.palette.primary.main,
    textDecoration: "underline"
  }
}));

const routeNames: Record<string, string> = {
  "/": "Dashboard",
  "/auth": "Auth",
  "/auth/login": "Login",
  "/docker": "Docker",
  "/docker/containers": "Containers",
  "/docker/images": "Images",
  "/docker/volumes": "Volumes",
  "/docker/networks": "Networks",
  "/docker/logs": "Logs",
  "/docker/files": "File Browser",
  "/domains": "Domains",
  "/ssl": "SSL Certificates",
  "/nginx": "Nginx Config",
  "/proxies": "Proxy Manager",
  "/email": "Email",
  "/users": "Users"
};

const specialRoutes: Record<string, string> = {
  "shell": "Shell"
};

interface BreadcrumbItem {
  label: string;
  href: string;
}

const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  if (!pathname || pathname === "/") {
    return [{ label: "Dashboard", href: "/" }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Dashboard", href: "/" }];

  let currentPath = "";
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Check if it's a known route
    if (routeNames[currentPath]) {
      breadcrumbs.push({
        label: routeNames[currentPath],
        href: currentPath
      });
    } else if (specialRoutes[segment]) {
      // Special routes like "shell"
      breadcrumbs.push({
        label: specialRoutes[segment],
        href: currentPath
      });
    } else {
      // For detail pages (e.g., container ID)
      const parentPath = `/${segments.slice(0, index).join("/")}`;
      const parentRouteName = routeNames[parentPath];
      
      if (parentRouteName) {
        // This is a detail page
        const shortId = segment.length > 12 ? `${segment.substring(0, 12)}...` : segment;
        breadcrumbs.push({
          label: shortId,
          href: currentPath
        });
      }
    }
  });

  return breadcrumbs;
};

const PageBreadcrumbs = () => {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname || "/");

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="breadcrumb"
    >
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isFirst = index === 0;

        if (isLast) {
          return (
            <Typography
              key={crumb.href}
              variant="body2"
              color="text.primary"
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              {isFirst && <HomeIcon fontSize="small" />}
              {crumb.label}
            </Typography>
          );
        }

        return (
          <Link key={crumb.href} href={crumb.href} passHref legacyBehavior>
            <BreadcrumbLink>
              {isFirst && <HomeIcon fontSize="small" />}
              {crumb.label}
            </BreadcrumbLink>
          </Link>
        );
      })}
    </Breadcrumbs>
  );
};

export default PageBreadcrumbs;
