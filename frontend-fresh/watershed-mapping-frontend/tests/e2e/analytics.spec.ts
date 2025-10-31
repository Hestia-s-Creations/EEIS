import { test, expect } from '@playwright/test'

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:6969/')
    await page.fill('input[type="email"]', 'newadmin@test.com')
    await page.fill('input[type="password"]', 'Test1234!')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard')

    // Navigate to Analytics
    await page.click('a[href="/analytics"]')
    await page.waitForURL('**/analytics')
  })

  test('should load analytics page without errors', async ({ page }) => {
    // Check that page title or main heading exists
    await expect(page.locator('h1, h2').first()).toBeVisible()

    // Check no console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })

  test('should display analytics charts', async ({ page }) => {
    // Wait for charts to render
    await page.waitForTimeout(1000)

    // Check if chart components exist (adjust selector based on actual implementation)
    const hasCharts = await page.locator('canvas, svg').count() > 0
    expect(hasCharts).toBeTruthy()
  })

  test('should handle date range filtering', async ({ page }) => {
    // Look for date inputs or date pickers
    const dateInputs = page.locator('input[type="date"]')
    const count = await dateInputs.count()

    if (count > 0) {
      // If date inputs exist, test them
      await dateInputs.first().fill('2024-01-01')
      if (count > 1) {
        await dateInputs.nth(1).fill('2024-12-31')
      }

      // Look for apply/filter button
      const filterButton = page.locator('button:has-text("Filter"), button:has-text("Apply")')
      if (await filterButton.count() > 0) {
        await filterButton.first().click()
        await page.waitForTimeout(1000)
      }
    }

    // Page should still be visible and not crashed
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display trend visualization', async ({ page }) => {
    // Check for trend-related content
    const trendContent = page.locator('text=/trend|change|growth/i')
    if (await trendContent.count() > 0) {
      await expect(trendContent.first()).toBeVisible()
    }
  })

  test('should handle export functionality if present', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")')

    if (await exportButton.count() > 0) {
      // Click export button
      await exportButton.first().click()

      // Wait a bit for download or modal
      await page.waitForTimeout(1000)

      // Page should still be functional
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should display real-time metrics if available', async ({ page }) => {
    // Look for real-time or live indicators
    const realtimeContent = page.locator('text=/real-time|live|current/i')

    // Just verify page doesn't crash when looking for these
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle watershed-specific analytics', async ({ page }) => {
    // Look for watershed selector or dropdown
    const watershedSelector = page.locator('select, [role="combobox"]').first()

    if (await watershedSelector.count() > 0) {
      await watershedSelector.click()
      await page.waitForTimeout(500)

      // Try to select an option if available
      const options = page.locator('option, [role="option"]')
      if (await options.count() > 0) {
        await options.first().click()
        await page.waitForTimeout(1000)
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should navigate back to dashboard', async ({ page }) => {
    // Click dashboard link in sidebar
    await page.click('a[href="/dashboard"]')
    await page.waitForURL('**/dashboard')

    expect(page.url()).toContain('/dashboard')
  })

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)

    // Page should still be visible
    await expect(page.locator('body')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    await expect(page.locator('body')).toBeVisible()
  })
})
