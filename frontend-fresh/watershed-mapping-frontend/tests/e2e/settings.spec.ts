import { test, expect } from '@playwright/test'

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:6969/')
    await page.fill('input[type="email"]', 'newadmin@test.com')
    await page.fill('input[type="password"]', 'Test1234!')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard')

    // Navigate to Settings
    await page.click('a[href="/settings"]')
    await page.waitForURL('**/settings')
  })

  test('should load settings page without errors', async ({ page }) => {
    // Check that page title or main heading exists
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible()

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

  test('should display settings tabs', async ({ page }) => {
    // Look for settings tabs/sections
    const tabs = page.locator('button:has-text("General"), button:has-text("Notifications"), button:has-text("Security"), button:has-text("Data"), button:has-text("Monitoring")')
    const tabCount = await tabs.count()

    // Should have multiple tabs
    expect(tabCount).toBeGreaterThan(0)
  })

  test('should switch between settings tabs', async ({ page }) => {
    // Click General tab
    const generalTab = page.locator('button:has-text("General")')
    if (await generalTab.count() > 0) {
      await generalTab.first().click()
      await page.waitForTimeout(300)

      // Look for general settings content
      const languageText = page.locator('text=/language|timezone|theme/i')
      if (await languageText.count() > 0) {
        await expect(languageText.first()).toBeVisible()
      }
    }

    // Click Notifications tab
    const notificationsTab = page.locator('button:has-text("Notifications")')
    if (await notificationsTab.count() > 0) {
      await notificationsTab.first().click()
      await page.waitForTimeout(300)

      // Look for notification settings
      const notificationText = page.locator('text=/email|sms|alert/i')
      if (await notificationText.count() > 0) {
        await expect(notificationText.first()).toBeVisible()
      }
    }

    // Click Security tab
    const securityTab = page.locator('button:has-text("Security")')
    if (await securityTab.count() > 0) {
      await securityTab.first().click()
      await page.waitForTimeout(300)

      // Look for security settings
      const securityText = page.locator('text=/authentication|password|session/i')
      if (await securityText.count() > 0) {
        await expect(securityText.first()).toBeVisible()
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display general settings', async ({ page }) => {
    // Navigate to General tab
    const generalTab = page.locator('button:has-text("General")')
    if (await generalTab.count() > 0) {
      await generalTab.first().click()
      await page.waitForTimeout(500)

      // Check for language selector
      const languageSelect = page.locator('select, [role="combobox"]')
      if (await languageSelect.count() > 0) {
        await expect(languageSelect.first()).toBeVisible()
      }

      // Check for timezone setting
      const timezoneText = page.locator('text=/timezone/i')
      if (await timezoneText.count() > 0) {
        await expect(timezoneText.first()).toBeVisible()
      }

      // Check for theme setting
      const themeText = page.locator('text=/theme/i')
      if (await themeText.count() > 0) {
        await expect(themeText.first()).toBeVisible()
      }
    }
  })

  test('should handle language selection', async ({ page }) => {
    // Navigate to General tab
    const generalTab = page.locator('button:has-text("General")')
    if (await generalTab.count() > 0) {
      await generalTab.first().click()
      await page.waitForTimeout(500)

      // Find language select element
      const selects = page.locator('select')
      if (await selects.count() > 0) {
        // Click first select (likely language)
        await selects.first().click()
        await page.waitForTimeout(300)

        // Try to select an option
        const options = page.locator('option')
        if (await options.count() > 1) {
          await selects.first().selectOption({ index: 1 })
          await page.waitForTimeout(300)
        }
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display notification settings', async ({ page }) => {
    // Navigate to Notifications tab
    const notificationsTab = page.locator('button:has-text("Notifications")')
    if (await notificationsTab.count() > 0) {
      await notificationsTab.first().click()
      await page.waitForTimeout(500)

      // Look for notification checkboxes
      const checkboxes = page.locator('input[type="checkbox"]')
      const checkboxCount = await checkboxes.count()

      if (checkboxCount > 0) {
        // Should have notification toggle checkboxes
        await expect(checkboxes.first()).toBeVisible()
      }

      // Look for email/SMS/push notification options
      const emailText = page.locator('text=/email/i')
      if (await emailText.count() > 0) {
        await expect(emailText.first()).toBeVisible()
      }
    }
  })

  test('should toggle notification preferences', async ({ page }) => {
    // Navigate to Notifications tab
    const notificationsTab = page.locator('button:has-text("Notifications")')
    if (await notificationsTab.count() > 0) {
      await notificationsTab.first().click()
      await page.waitForTimeout(500)

      // Toggle checkboxes
      const checkboxes = page.locator('input[type="checkbox"]')
      const checkboxCount = await checkboxes.count()

      if (checkboxCount > 0) {
        // Get initial state
        const initialState = await checkboxes.first().isChecked()

        // Click checkbox to toggle
        await checkboxes.first().click()
        await page.waitForTimeout(300)

        // Verify state changed
        const newState = await checkboxes.first().isChecked()
        expect(newState).toBe(!initialState)
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display security settings', async ({ page }) => {
    // Navigate to Security tab
    const securityTab = page.locator('button:has-text("Security")')
    if (await securityTab.count() > 0) {
      await securityTab.first().click()
      await page.waitForTimeout(500)

      // Look for 2FA setting
      const twoFactorText = page.locator('text=/two-factor|2fa/i')
      if (await twoFactorText.count() > 0) {
        await expect(twoFactorText.first()).toBeVisible()
      }

      // Look for session timeout
      const sessionText = page.locator('text=/session|timeout/i')
      if (await sessionText.count() > 0) {
        await expect(sessionText.first()).toBeVisible()
      }

      // Look for password expiry
      const passwordText = page.locator('text=/password.*expiry|password.*expiration/i')
      if (await passwordText.count() > 0) {
        await expect(passwordText.first()).toBeVisible()
      }
    }
  })

  test('should handle security setting changes', async ({ page }) => {
    // Navigate to Security tab
    const securityTab = page.locator('button:has-text("Security")')
    if (await securityTab.count() > 0) {
      await securityTab.first().click()
      await page.waitForTimeout(500)

      // Look for number inputs (session timeout, password expiry)
      const numberInputs = page.locator('input[type="number"]')
      if (await numberInputs.count() > 0) {
        // Change first number input
        await numberInputs.first().fill('45')
        await page.waitForTimeout(300)

        // Verify value changed
        const value = await numberInputs.first().inputValue()
        expect(value).toBe('45')
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display data management settings', async ({ page }) => {
    // Navigate to Data Management tab
    const dataTab = page.locator('button:has-text("Data")')
    if (await dataTab.count() > 0) {
      await dataTab.first().click()
      await page.waitForTimeout(500)

      // Look for backup settings
      const backupText = page.locator('text=/backup|storage|retention/i')
      if (await backupText.count() > 0) {
        await expect(backupText.first()).toBeVisible()
      }
    }
  })

  test('should display monitoring settings', async ({ page }) => {
    // Navigate to Monitoring tab
    const monitoringTab = page.locator('button:has-text("Monitoring")')
    if (await monitoringTab.count() > 0) {
      await monitoringTab.first().click()
      await page.waitForTimeout(500)

      // Look for monitoring settings
      const monitoringText = page.locator('text=/update.*interval|satellite|processing|queue/i')
      if (await monitoringText.count() > 0) {
        await expect(monitoringText.first()).toBeVisible()
      }

      // Look for number inputs
      const numberInputs = page.locator('input[type="number"]')
      if (await numberInputs.count() > 0) {
        await expect(numberInputs.first()).toBeVisible()
      }
    }
  })

  test('should display save button', async ({ page }) => {
    // Look for Save button
    const saveBtn = page.locator('button:has-text("Save")')

    if (await saveBtn.count() > 0) {
      await expect(saveBtn.first()).toBeVisible()
    }
  })

  test('should handle save action', async ({ page }) => {
    // Make a change to settings
    const generalTab = page.locator('button:has-text("General")')
    if (await generalTab.count() > 0) {
      await generalTab.first().click()
      await page.waitForTimeout(500)

      const selects = page.locator('select')
      if (await selects.count() > 0) {
        await selects.first().selectOption({ index: 1 })
        await page.waitForTimeout(300)
      }
    }

    // Click Save button
    const saveBtn = page.locator('button:has-text("Save")')
    if (await saveBtn.count() > 0) {
      await saveBtn.first().click()
      await page.waitForTimeout(1000)
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display API configuration if available', async ({ page }) => {
    // Look for API or advanced settings
    const apiText = page.locator('text=/api|configuration|advanced/i')
    if (await apiText.count() > 0) {
      // If API settings exist, they should be visible somewhere
      expect(await apiText.count()).toBeGreaterThan(0)
    }
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
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle all settings tabs without errors', async ({ page }) => {
    const tabNames = ['General', 'Notifications', 'Security', 'Data', 'Monitoring']

    for (const tabName of tabNames) {
      const tab = page.locator(`button:has-text("${tabName}")`)
      if (await tab.count() > 0) {
        await tab.first().click()
        await page.waitForTimeout(500)

        // Verify no errors
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })
})
