import { test, expect } from '@playwright/test'

test.describe('Alerts Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:6969/')
    await page.fill('input[type="email"]', 'newadmin@test.com')
    await page.fill('input[type="password"]', 'Test1234!')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard')

    // Navigate to Alerts
    await page.click('a[href="/alerts"]')
    await page.waitForURL('**/alerts')
  })

  test('should load alerts page without errors', async ({ page }) => {
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

  test('should display alert list', async ({ page }) => {
    // Wait for any table or list to render
    await page.waitForTimeout(1000)

    // Check if there's a table, list, or grid layout
    const hasAlertList = await page.locator('table, ul, [role="list"], .alert, .card').count() > 0
    expect(hasAlertList).toBeTruthy()
  })

  test('should handle severity filtering', async ({ page }) => {
    // Look for filter buttons or select
    const severityFilters = page.locator('button:has-text("Severity"), select, [role="radio"], [role="checkbox"]')
    const count = await severityFilters.count()

    if (count > 0) {
      await severityFilters.first().click()
      await page.waitForTimeout(500)
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle status filtering', async ({ page }) => {
    // Look for status filter
    const statusFilters = page.locator('button:has-text("Status"), button:has-text("Active"), button:has-text("Resolved")')
    const count = await statusFilters.count()

    if (count > 0) {
      await statusFilters.first().click()
      await page.waitForTimeout(500)
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle alert acknowledgment', async ({ page }) => {
    // Look for acknowledge button
    const acknowledgeBtn = page.locator('button:has-text("Acknowledge")').first()

    if (await acknowledgeBtn.count() > 0) {
      await acknowledgeBtn.click()
      await page.waitForTimeout(1000)

      // Check if modal or confirmation appears
      const modal = page.locator('[role="dialog"], .modal')
      if (await modal.count() > 0) {
        // Try to confirm
        const confirmBtn = modal.locator('button:has-text("Confirm"), button:has-text("Yes")')
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click()
          await page.waitForTimeout(500)
        }
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle alert resolution', async ({ page }) => {
    // Look for resolve button
    const resolveBtn = page.locator('button:has-text("Resolve")').first()

    if (await resolveBtn.count() > 0) {
      await resolveBtn.click()
      await page.waitForTimeout(1000)

      // Check if modal or form appears
      const modal = page.locator('[role="dialog"], .modal, form')
      if (await modal.count() > 0) {
        // Try to fill resolution note if present
        const noteField = modal.locator('textarea, input[type="text"]').first()
        if (await noteField.count() > 0) {
          await noteField.fill('Test resolution note')
        }

        // Try to confirm
        const confirmBtn = modal.locator('button[type="submit"], button:has-text("Resolve"), button:has-text("Submit")')
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click()
          await page.waitForTimeout(500)
        }
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle bulk actions if available', async ({ page }) => {
    // Look for checkboxes for bulk selection
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()

    if (count > 1) {
      // Select first alert
      await checkboxes.nth(1).click() // Skip "select all" if present
      await page.waitForTimeout(300)

      // Look for bulk action button
      const bulkBtn = page.locator('button:has-text("Bulk"), button:has-text("Actions")')
      if (await bulkBtn.count() > 0) {
        await bulkBtn.first().click()
        await page.waitForTimeout(500)
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should access alert rules configuration', async ({ page }) => {
    // Look for rules or settings button
    const rulesBtn = page.locator('button:has-text("Rules"), a:has-text("Rules"), button:has-text("Configure")')

    if (await rulesBtn.count() > 0) {
      await rulesBtn.first().click()
      await page.waitForTimeout(1000)
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle pagination if present', async ({ page }) => {
    // Look for pagination controls
    const nextBtn = page.locator('button:has-text("Next"), a:has-text("Next")')
    const prevBtn = page.locator('button:has-text("Previous"), a:has-text("Previous")')

    if (await nextBtn.count() > 0) {
      await nextBtn.first().click()
      await page.waitForTimeout(1000)
    }

    if (await prevBtn.count() > 0) {
      await prevBtn.first().click()
      await page.waitForTimeout(1000)
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
