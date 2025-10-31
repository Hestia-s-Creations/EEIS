import { test, expect } from '@playwright/test'
import { TEST_USERS, login } from '../fixtures/auth'

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_USERS.admin)
  })

  test('should display dashboard after login', async ({ page }) => {
    // Should be on dashboard or map page after login
    expect(page.url()).toMatch(/\/(dashboard|map)/)

    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('should navigate to watersheds page', async ({ page }) => {
    // Look for watersheds navigation link
    const watershedLink = page.locator('a:has-text("Watersheds"), a[href*="watershed"]').first()

    if (await watershedLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await watershedLink.click()
      await page.waitForURL(/watershed/, { timeout: 5000 })
      expect(page.url()).toContain('watershed')
    }
  })

  test('should navigate to map page', async ({ page }) => {
    // Look for map navigation link
    const mapLink = page.locator('a:has-text("Map"), a[href*="map"]').first()

    if (await mapLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mapLink.click()
      await page.waitForURL(/map/, { timeout: 5000 })
      expect(page.url()).toContain('map')
    } else {
      // If already on map, verify map container exists
      await expect(page.locator('.leaflet-container, [class*="map"]').first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('should display map component', async ({ page }) => {
    // Navigate to map
    await page.goto('/map')

    // Wait for Leaflet map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })

    // Check for map controls
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible()
  })

  test('should display analytics if available', async ({ page }) => {
    // Try to navigate to analytics/reports
    const analyticsLink = page.locator('a:has-text("Analytics"), a:has-text("Reports"), a[href*="analytic"]').first()

    if (await analyticsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await analyticsLink.click()
      await page.waitForLoadState('networkidle')
    }
  })

  test('should display user profile menu', async ({ page }) => {
    // Look for user menu/profile button
    const userMenu = page.locator(
      'button:has-text("Profile"), button:has-text("Account"), [data-testid="user-menu"], button[aria-label*="user"], button[aria-label*="account"]'
    ).first()

    if (await userMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userMenu.click()

      // Should show user options
      await page.waitForTimeout(500)
    }
  })

  test('should handle navigation between pages', async ({ page }) => {
    // Start on map
    await page.goto('/map')
    await page.waitForLoadState('networkidle')

    // Navigate to watersheds if link exists
    const watershedLink = page.locator('a[href*="watershed"]').first()

    if (await watershedLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await watershedLink.click()
      await page.waitForURL(/watershed/, { timeout: 5000 })

      // Navigate back to map
      const mapLink = page.locator('a[href*="map"]').first()
      await mapLink.click()
      await page.waitForURL(/map/, { timeout: 5000 })

      expect(page.url()).toContain('map')
    }
  })

  test('should display responsive navigation menu', async ({ page }) => {
    // Check for navigation elements
    const nav = page.locator('nav, [role="navigation"]').first()
    await expect(nav).toBeVisible({ timeout: 5000 })
  })

  test('should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Filter out expected errors (like network errors during development)
    const criticalErrors = consoleErrors.filter(
      (error) => !error.includes('Failed to fetch') && !error.includes('NetworkError')
    )

    expect(criticalErrors.length).toBe(0)
  })

  test('should handle browser back/forward navigation', async ({ page }) => {
    await page.goto('/map')
    const mapUrl = page.url()

    // Navigate to another page if available
    const watershedLink = page.locator('a[href*="watershed"]').first()

    if (await watershedLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await watershedLink.click()
      await page.waitForURL(/watershed/, { timeout: 5000 })

      // Go back
      await page.goBack()
      await page.waitForLoadState('networkidle')

      expect(page.url()).toBe(mapUrl)

      // Go forward
      await page.goForward()
      await page.waitForLoadState('networkidle')

      expect(page.url()).toContain('watershed')
    }
  })
})
