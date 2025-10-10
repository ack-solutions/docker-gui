import { combineReducers } from "@reduxjs/toolkit";
import containersReducer from "@/store/docker/slice";

const dockerReducer = combineReducers({
  containers: containersReducer
});

export default dockerReducer;
