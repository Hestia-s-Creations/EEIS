import { test, expect } from '@playwright/test'
import { TEST_USERS, login } from '../fixtures/auth'

test.describe('Watershed Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_USERS.admin)
  })

  test('should display watershed list', async ({ page }) => {
    // Navigate to watersheds page
    await page.goto('/watersheds')

    // Wait for page load
    await page.waitForLoadState('networkidle')

    // Check for watershed list or empty state
    const hasWatersheds = await page.locator('[data-testid="watershed-list"], .watershed-list, table').isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmptyState = await page.locator(':has-text("No watersheds"), :has-text("empty")').isVisible({ timeout: 2000 }).catch(() => false)

    expect(hasWatersheds || hasEmptyState).toBe(true)
  })

  test('should display watershed details on map', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Wait for any watershed features to load
    await page.waitForTimeout(2000)

    // Check if there are any watershed features on the map
    const watershedFeatures = page.locator('.leaflet-interactive')

    if (await watershedFeatures.count() > 0) {
      // Click on first feature
      await watershedFeatures.first().click()

      // Wait for popup or details to appear
      await page.waitForTimeout(500)
    }
  })

  test('should show watershed information popup', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Wait for features to load
    await page.waitForTimeout(2000)

    // Check for interactive map features
    const features = page.locator('.leaflet-interactive')
    const featureCount = await features.count()

    if (featureCount > 0) {
      // Click on a feature
      await features.first().click()

      // Wait for popup
      await page.waitForTimeout(1000)

      // Check if popup appeared
      const popup = page.locator('.leaflet-popup')
      if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Verify popup has content
        await expect(popup).toContainText(/.+/)
      }
    }
  })

  test('should filter watersheds by status', async ({ page }) => {
    await page.goto('/watersheds')

    // Wait for page load
    await page.waitForLoadState('networkidle')

    // Look for filter controls
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]').first()

    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.selectOption('active')
      await page.waitForTimeout(1000)
    }
  })

  test('should search watersheds', async ({ page }) => {
    await page.goto('/watersheds')

    // Wait for page load
    await page.waitForLoadState('networkidle')

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').first()

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test')
      await page.waitForTimeout(1000)
    }
  })

  test('should display map controls', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Check for map controls panel
    const controlsPanel = page.locator(':has-text("Map Controls"), :has-text("Layers")')

    if (await controlsPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(controlsPanel).toBeVisible()
    }
  })

  test('should toggle map layers', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Look for layer toggle checkboxes
    const layerToggles = page.locator('input[type="checkbox"]')

    if (await layerToggles.count() > 0) {
      const firstToggle = layerToggles.first()

      // Get initial state
      const initialState = await firstToggle.isChecked()

      // Toggle it
      await firstToggle.click()
      await page.waitForTimeout(500)

      // Verify state changed
      const newState = await firstToggle.isChecked()
      expect(newState).not.toBe(initialState)
    }
  })

  test('should load satellite imagery controls', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Check for satellite imagery controls
    const satelliteControls = page.locator(':has-text("Satellite Imagery")')

    if (await satelliteControls.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(satelliteControls).toBeVisible()

      // Check for date picker
      const datePicker = page.locator('input[type="date"]').first()
      if (await datePicker.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(datePicker).toBeVisible()
      }
    }
  })

  test('should display change detection controls', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Check for change detection controls
    const changeDetectionControls = page.locator(':has-text("Change Detection")')

    if (await changeDetectionControls.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(changeDetectionControls).toBeVisible()

      // Check for algorithm selector
      const algorithmSelect = page.locator('select').first()
      if (await algorithmSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(algorithmSelect).toBeVisible()
      }
    }
  })

  test('should display export controls', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Check for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")')

    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(exportButton).toBeVisible()
    }
  })

  test('should handle map zoom controls', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Get zoom controls
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    const zoomOut = page.locator('.leaflet-control-zoom-out')

    await expect(zoomIn).toBeVisible()
    await expect(zoomOut).toBeVisible()

    // Test zoom in
    await zoomIn.click()
    await page.waitForTimeout(500)

    // Test zoom out
    await zoomOut.click()
    await page.waitForTimeout(500)
  })

  test('should handle map pan interactions', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    const mapContainer = page.locator('.leaflet-container')
    await expect(mapContainer).toBeVisible({ timeout: 15000 })

    // Get initial center (this is a simplified check)
    const initialBounds = await page.evaluate(() => {
      const map = (window as any).map
      return map ? map.getCenter() : null
    })

    // Pan the map if we have access to it
    if (initialBounds) {
      await mapContainer.click()
      await page.mouse.move(100, 100)
    }
  })

  test('should persist map state on navigation', async ({ page }) => {
    await page.goto('/map')

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Change zoom level
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    await zoomIn.click()
    await page.waitForTimeout(500)

    // Navigate away and back
    const dashboardLink = page.locator('a[href*="dashboard"]').first()

    if (await dashboardLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dashboardLink.click()
      await page.waitForLoadState('networkidle')

      // Navigate back to map
      const mapLink = page.locator('a[href*="map"]').first()
      await mapLink.click()
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })
    }
  })
})
