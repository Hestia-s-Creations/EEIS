import { configureStore } from '@reduxjs/toolkit'
import authSlice from './slices/authSlice'
import mapSlice from './slices/mapSlice'
import watershedSlice from './slices/watershedSlice'
import alertSlice from './slices/alertSlice'
import uiSlice from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authSlice,
    map: mapSlice,
    watershed: watershedSlice,
    alerts: alertSlice,
    ui: uiSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization checks
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore these paths in the state for serialization checks
        ignoredPaths: ['map.mapInstance'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

// Export hooks for using Redux state and dispatch in components
export const useAppDispatch = () => store.dispatch
export const useAppSelector = useSelector