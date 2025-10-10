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
  "/server": "Server",
  "/server/docker": "Docker",
  "/server/docker/containers": "Containers",
  "/server/docker/images": "Images",
  "/server/docker/volumes": "Volumes",
  "/server/docker/networks": "Networks",
  "/server/docker/logs": "Logs",
  "/server/docker/files": "File Browser",
  "/server/domains": "Domains",
  "/server/ssl": "SSL Certificates",
  "/server/nginx": "Nginx Config",
  "/server/proxies": "Proxy Manager",
  "/server/email": "Email",
  "/server/users": "Users",
  "/containers": "Containers",
  "/images": "Images",
  "/volumes": "Volumes",
  "/networks": "Networks",
  "/logs": "Logs",
  "/files": "File Browser"
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
