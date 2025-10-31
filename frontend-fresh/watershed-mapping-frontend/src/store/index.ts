import { configureStore } from '@reduxjs/toolkit'
import authSlice from './slices/authSlice'
import watershedSlice from './slices/watershedSlice'
import mapSlice from './slices/mapSlice'
import alertSlice from './slices/alertSlice'
import analyticsSlice from './slices/analyticsSlice'

export const store = configureStore({
  reducer: {
    auth: authSlice,
    watershed: watershedSlice,
    map: mapSlice,
    alert: alertSlice,
    analytics: analyticsSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch