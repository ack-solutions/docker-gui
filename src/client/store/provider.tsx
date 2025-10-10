"use client";

import { PropsWithChildren, useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/store/store";
import { fetchContainers } from "@/store/docker/slice";

const StoreProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const storeRef = useRef<AppStore>();
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  useEffect(() => {
    if (!storeRef.current) {
      return;
    }
    storeRef.current.dispatch(fetchContainers());
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
};

export default StoreProvider;
