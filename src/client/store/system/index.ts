import { combineReducers } from "@reduxjs/toolkit";
import metricsReducer from "@/store/system/slice";

const systemReducer = combineReducers({
  metrics: metricsReducer
});

export default systemReducer;
