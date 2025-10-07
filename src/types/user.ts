export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
}

export interface UserRecord extends User {
  passwordHash: string;
}
