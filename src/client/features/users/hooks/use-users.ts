"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, deleteUser, fetchUsers, updateUser } from "@/lib/api/server";
import type { CreateUserInput, UpdateUserInput, User } from "@/types/user";

export const userQueryKeys = {
  all: ["users"] as const
};

export const useUsers = () =>
  useQuery<User[]>({
    queryKey: userQueryKeys.all,
    queryFn: fetchUsers
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserInput) => createUser(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
    }
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserInput }) => updateUser(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
    }
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
    }
  });
};
