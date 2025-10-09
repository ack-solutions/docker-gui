export const containerQueryKeys = {
  all: ["containers"] as const,
  detail: (id: string) => ["containers", id] as const
};
