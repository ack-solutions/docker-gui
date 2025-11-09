import { useCallback, useEffect, useMemo, useState } from "react";

interface UsePersistentStateOptions<T> {
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

export function usePersistentState<T>(key: string, defaultValue: T, options?: UsePersistentStateOptions<T>) {
  const serializeOption = options?.serialize;
  const deserializeOption = options?.deserialize;
  const defaultValueType = useMemo(() => {
    if (Array.isArray(defaultValue)) {
      return "array";
    }
    if (defaultValue === null) {
      return "null";
    }
    return typeof defaultValue;
  }, [defaultValue]);

  const serialize = useMemo<(value: T) => string>(() => {
    if (serializeOption) {
      return serializeOption;
    }
    switch (defaultValueType) {
      case "string":
        return (value: T) => String(value);
      case "number":
      case "boolean":
        return (value: T) => String(value);
      default:
        return (value: T) => JSON.stringify(value);
    }
  }, [serializeOption, defaultValueType]);

  const deserialize = useMemo<(stored: string) => T>(() => {
    if (deserializeOption) {
      return deserializeOption;
    }
    switch (defaultValueType) {
      case "string":
        return (stored: string) => stored as unknown as T;
      case "number":
        return (stored: string) => {
          const parsed = Number(stored);
          return (Number.isNaN(parsed) ? defaultValue : (parsed as unknown as T));
        };
      case "boolean":
        return (stored: string) => (stored === "true") as unknown as T;
      default:
        return (stored: string) => JSON.parse(stored) as T;
    }
  }, [deserializeOption, defaultValueType, defaultValue]);

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") {
      return defaultValue;
    }

    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue === null) {
        return defaultValue;
      }
      return deserialize(storedValue);
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const serialized = serialize(state);
      window.localStorage.setItem(key, serialized);
    } catch {
      // Ignore write errors
    }
  }, [key, state, serialize]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== key) {
        return;
      }

      if (event.newValue === null) {
        setState(defaultValue);
        return;
      }

      try {
        setState(deserialize(event.newValue));
      } catch {
        setState(defaultValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [key, deserialize, defaultValue]);

  const setPersistentState = useCallback(
    (value: T | ((previous: T) => T)) => {
      setState((previous) => {
        const nextValue =
          typeof value === "function"
            ? (value as (prev: T) => T)(previous)
            : value;
        return nextValue;
      });
    },
    []
  );

  return [state, setPersistentState] as const;
}

