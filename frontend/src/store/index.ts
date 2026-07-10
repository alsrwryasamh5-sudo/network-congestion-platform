import { configureStore } from '@reduxjs/toolkit';
import authReducer, { User } from './slices/authSlice';
import uiReducer from './slices/uiSlice';

export type { User };

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
