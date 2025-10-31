# Map Rendering Investigation - Issue #4

**Date**: 2025-10-30
**Status**: 🔴 **UNRESOLVED** - React 18 + Leaflet Compatibility Issue
**Priority**: CRITICAL
**Affects**: 11 out of 13 watershed tests (85% failure rate)

---

## Summary

The Leaflet map component fails to render with error: `TypeError: render2 is not a function`. This is a React 18 concurrent rendering compatibility issue with react-leaflet 5.0.0.

---

## Root Cause Analysis

### Issues Discovered and Fixed

1. ✅ **MapView.tsx not fetching watersheds** (FIXED)
   - **Problem**: Component checked `watershedsLoading` state but never dispatched `fetchWatersheds()`
   - **Fix**: Added `dispatch(fetchWatersheds({ page: 1, limit: 100 }))` to MapView useEffect
   - **Commit**: 47e0665

2. ✅ **Unused leaflet-draw imports** (FIXED)
   - **Problem**: Imported `EditControl` and CSS from react-leaflet-draw but never used
   - **Fix**: Removed unused imports
   - **Commit**: 0590857

3. ✅ **Watersheds undefined error** (FIXED)
   - **Problem**: LeafletMap crashed with "Cannot read properties of undefined (reading 'length')"
   - **Fix**: Added default empty array: `const { watersheds = [] } = useSelector(...)`
   - **Commit**: 755d91d

4. ✅ **Added isMounted check** (ATTEMPTED FIX - Did not resolve)
   - **Problem**: React 18 StrictMode double-rendering causing issues
   - **Fix**: Added isMounted state to delay map rendering
   - **Commit**: 15ccdeb
   - **Result**: Error still occurs

### Current Blocker

**Error**: `TypeError: render2 is not a function`

**Error Stack Trace**:
```
at updateContextConsumer (http://localhost:5173/node_modules/.vite/deps/chunk-HBJ3AJOL.js?v=b8dd37f7:15747:27)
at beginWork (http://localhost:5173/node_modules/.vite/deps/chunk-HBJ3AJOL.js?v=b8dd37f7:16005:22)
at beginWork$1 (http://localhost:5173/node_modules/.vite/deps/chunk-HBJ3AJOL.js?v=b8dd37f7:19806:22)
at performUnitOfWork (http://localhost:5173/node_modules/.vite/deps/chunk-HBJ3AJOL.js?v=b8dd37f7:19251:20)
at workLoopSync (http://localhost:5173/node_modules/.vite/deps/chunk-HBJ3AJOL.js?v=b8dd37f7:19190:13)
at renderRootSync (http://localhost:5173/node_modules/.vite/deps/chunk-HBJ3AJOL.js?v=b8dd37f7:19169:15)
at recoverFromConcurrentError (http://localhost:5173/node_modules/.vite/deps/chunk-HBJ3AJOL.js?v=b8dd37f7:18786:28)
at performSyncWorkOnRoot (http://localhost:5173/node_modules/.vite/deps/chunk-HBJ3AJOL.js?v=b8dd37f7:18932:28)
```

**Analysis**:
- Error occurs in React's internal rendering cycle (`updateContextConsumer`, `beginWork`)
- Happens during Vite's development HMR (Hot Module Replacement)
- Related to React 18's new concurrent rendering features
- react-leaflet 5.0.0 may have compatibility issues with React 18.3.1

---

## Package Versions

```json
{
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "react-leaflet": "5.0.0",
  "leaflet": "^1.9.4",
  "leaflet-draw": "^1.0.4",
  "react-leaflet-draw": "^0.21.0"
}
```

---

## Attempted Solutions

### ✅ Solution 1: Fix MapView Data Fetching
**Status**: FIXED
**Impact**: Resolved initial loading state issue

### ✅ Solution 2: Remove Unused Imports
**Status**: FIXED
**Impact**: Cleaned up code, reduced potential conflicts

### ✅ Solution 3: Add Default Array for Watersheds
**Status**: FIXED
**Impact**: Prevented undefined length errors

### ❌ Solution 4: Add isMounted Check
**Status**: ATTEMPTED - Did not resolve
**Impact**: Error occurs before mount completes

---

## Potential Solutions to Try Next

### Solution 5: Disable StrictMode for Map Component
**Approach**: Wrap LeafletMap in a component without StrictMode
**Likelihood**: Medium - StrictMode causes double-rendering in React 18
**Risk**: Low - Only affects map component

```tsx
// Create MapWrapper.tsx
import { LeafletMap } from './LeafletMap'

const MapWrapper = () => {
  return <LeafletMap />
}

// In MapView.tsx, use MapWrapper without StrictMode
```

### Solution 6: Downgrade react-leaflet
**Approach**: Try react-leaflet 4.x which was built for React 18
**Likelihood**: High - Version mismatch is common cause
**Risk**: Medium - May need code changes

```bash
pnpm remove react-leaflet
pnpm add react-leaflet@^4.2.1
```

### Solution 7: Use Dynamic Import
**Approach**: Lazy load map component to avoid SSR/hydration issues
**Likelihood**: Medium
**Risk**: Low

```tsx
import dynamic from 'next/dynamic'

const LeafletMap = dynamic(
  () => import('./LeafletMap'),
  { ssr: false }
)
```

### Solution 8: Check for Duplicate React Instances
**Approach**: Ensure only one React instance is loaded
**Likelihood**: Medium
**Risk**: Low

```bash
cd frontend-fresh/watershed-mapping-frontend
pnpm why react
pnpm dedupe
```

### Solution 9: Add Vite Optimizations
**Approach**: Configure Vite to handle Leaflet better
**Likelihood**: High - Vite HMR might be the issue
**Risk**: Low

```js
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet']
  },
  build: {
    commonjsOptions: {
      include: [/leaflet/, /react-leaflet/, /node_modules/]
    }
  }
})
```

### Solution 10: Remove Leaflet Entirely (Last Resort)
**Approach**: Replace with a simpler mapping library
**Likelihood**: N/A - Only if all else fails
**Risk**: High - Major refactor required

---

## Test Results

### Before Fixes
- **Passing**: 2/13 watershed tests (15%)
- **Failing**: 11/13 map-related tests (85%)
- **Error**: Various (undefined errors, missing data, map not rendering)

### After Fixes
- **Passing**: 2/13 watershed tests (15%) - No change
- **Failing**: 11/13 map-related tests (85%) - No change
- **Error**: Consistent `render2 is not a function` error
- **Progress**: Eliminated 3 preliminary errors, isolated root cause

---

## Failing Tests

All tests navigate to `/map` route:

1. ❌ `should display watershed details on map` - Timeout waiting for `.leaflet-container`
2. ❌ `should show watershed information popup` - Map never renders
3. ❌ `should display map controls` - Map never renders
4. ❌ `should toggle map layers` - Map never renders
5. ❌ `should load satellite imagery controls` - Map never renders
6. ❌ `should display change detection controls` - Map never renders
7. ❌ `should display export controls` - Map never renders
8. ❌ `should handle map zoom controls` - Map never renders
9. ❌ `should handle map pan interactions` - Map never renders
10. ❌ `should persist map state on navigation` - Map never renders

---

## Impact on Overall Test Suite

- **Total Tests**: 155
- **Affected**: 11 tests (7% of all tests)
- **Current Pass Rate**: 36%
- **Projected Pass Rate** (if map fixed): 43% (+7%)

---

## Next Steps

### Immediate Actions (Priority Order)

1. **Try Solution 6**: Downgrade react-leaflet to 4.x (RECOMMENDED)
   - Fastest potential fix
   - react-leaflet 4.2.1 is stable with React 18
   - Low risk, easily reversible

2. **Try Solution 9**: Add Vite optimizations for Leaflet
   - May resolve HMR-related issues
   - No code changes required
   - Can combine with other solutions

3. **Try Solution 8**: Check for duplicate React instances
   - Quick diagnostic step
   - Can reveal hidden dependency conflicts

4. **Try Solution 5**: Disable StrictMode for map
   - If version downgrade doesn't work
   - Minimal code changes

5. **Try Solution 7**: Use dynamic import
   - If other solutions fail
   - Common pattern for client-only components

---

## Files Modified

1. `frontend-fresh/watershed-mapping-frontend/src/pages/MapView.tsx`
   - Added fetchWatersheds dispatch

2. `frontend-fresh/watershed-mapping-frontend/src/components/LeafletMap.tsx`
   - Removed unused leaflet-draw imports
   - Added watersheds default empty array
   - Added isMounted state and check

---

## Commits

- `47e0665` - Fix: MapView not fetching watersheds causing map render failure
- `0590857` - Fix: Remove unused leaflet-draw imports causing map render issues
- `755d91d` - Fix: Add default empty array for watersheds to prevent undefined error
- `15ccdeb` - Fix: Add isMounted check to prevent React 18 rendering issues with Leaflet

---

## References

- **react-leaflet GitHub**: https://github.com/PaulLeCam/react-leaflet
- **React 18 Migration Guide**: https://react.dev/blog/2022/03/08/react-18-upgrade-guide
- **Leaflet Documentation**: https://leafletjs.com/reference.html
- **Vite HMR API**: https://vitejs.dev/guide/api-hmr.html

---

**Recommendation**: Start with downgrading react-leaflet to 4.x as this is the most likely fix with minimal risk.
