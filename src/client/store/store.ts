import { configureStore, type EnhancedStore } from "@reduxjs/toolkit";
import dockerReducer from "@/store/docker";
import nginxReducer from "@/store/nginx/slice";
import systemReducer from "@/store/system";

export const makeStore = () =>
  configureStore({
    reducer: {
      docker: dockerReducer,
      nginx: nginxReducer,
      system: systemReducer
    }
  });

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
export type RootState = ReturnType<AppStore["getState"]>;

export type { EnhancedStore };
