import apiClient from "@/lib/api/client";
import type { User } from "@/types/user";

export interface AuthResponse {
  user: User;
  token: string;
}

export const registerUser = async (input: { email: string; password: string; name?: string }) => {
  const { data } = await apiClient.post<AuthResponse>("/auth/register", input);
  return data;
};

export const loginUser = async (input: { email: string; password: string }) => {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
  return data;
};

export const fetchCurrentUser = async () => {
  const { data } = await apiClient.get<{ user: User }>("/auth/me");
  return data.user;
};
