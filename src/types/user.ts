export const userPermissions = [
  "dashboard:view",
  "containers:view",
  "containers:manage",
  "images:view",
  "images:manage",
  "volumes:view",
  "volumes:manage",
  "networks:view",
  "networks:manage",
  "logs:view",
  "logs:manage",
  "files:view",
  "files:manage",
  "domains:view",
  "domains:manage",
  "ssl:view",
  "ssl:manage",
  "nginx:view",
  "nginx:manage",
  "proxies:view",
  "proxies:manage",
  "email:view",
  "email:manage",
  "users:manage",
  "settings:view",
  "settings:edit"
] as const;

export type UserPermission = (typeof userPermissions)[number];

export type UserRole = "admin" | "operator" | "viewer";

export const rolePermissions: Record<UserRole, UserPermission[]> = {
  admin: [...userPermissions],
  operator: [
    "dashboard:view",
    "containers:view",
    "containers:manage",
    "images:view",
    "images:manage",
    "volumes:view",
    "volumes:manage",
    "networks:view",
    "networks:manage",
    "logs:view",
    "logs:manage",
    "files:view",
    "files:manage",
    "domains:view",
    "ssl:view",
    "nginx:view",
    "proxies:view",
    "email:view",
    "settings:view",
    "settings:edit"
  ],
  viewer: [
    "dashboard:view",
    "containers:view",
    "images:view",
    "volumes:view",
    "networks:view",
    "logs:view",
    "files:view",
    "domains:view",
    "ssl:view",
    "nginx:view",
    "proxies:view",
    "email:view",
    "settings:view"
  ]
};

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  permissions: UserPermission[];
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface UserRecord extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string | null;
  role: UserRole;
  permissions?: UserPermission[];
  isSuperAdmin?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string | null;
  role?: UserRole;
  permissions?: UserPermission[];
  isSuperAdmin?: boolean;
}
