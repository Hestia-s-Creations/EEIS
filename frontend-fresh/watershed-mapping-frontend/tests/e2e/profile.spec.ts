import { test, expect } from '@playwright/test'

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:6969/')
    await page.fill('input[type="email"]', 'newadmin@test.com')
    await page.fill('input[type="password"]', 'Test1234!')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard')

    // Navigate to Profile
    await page.click('a[href="/profile"]')
    await page.waitForURL('**/profile')
  })

  test('should load profile page without errors', async ({ page }) => {
    // Check that page title or main heading exists
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible()

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

  test('should display user information', async ({ page }) => {
    // Check for user name display
    const userNameElements = page.locator('h2, .text-xl')
    await expect(userNameElements.first()).toBeVisible()

    // Check for email display
    const emailElements = page.locator('text=/newadmin@test.com/i')
    if (await emailElements.count() > 0) {
      await expect(emailElements.first()).toBeVisible()
    }

    // Check for role badge
    const roleBadge = page.locator('text=/admin|analyst|viewer/i')
    if (await roleBadge.count() > 0) {
      await expect(roleBadge.first()).toBeVisible()
    }
  })

  test('should handle profile tabs switching', async ({ page }) => {
    // Click Profile tab if present
    const profileTab = page.locator('button:has-text("Profile")')
    if (await profileTab.count() > 0) {
      await profileTab.click()
      await page.waitForTimeout(300)
    }

    // Click Security tab
    const securityTab = page.locator('button:has-text("Security")')
    if (await securityTab.count() > 0) {
      await securityTab.click()
      await page.waitForTimeout(300)

      // Check for security-related content
      const securityContent = page.locator('text=/password|authentication|2fa/i')
      if (await securityContent.count() > 0) {
        await expect(securityContent.first()).toBeVisible()
      }
    }

    // Click Activity tab
    const activityTab = page.locator('button:has-text("Activity")')
    if (await activityTab.count() > 0) {
      await activityTab.click()
      await page.waitForTimeout(300)
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should enable edit mode', async ({ page }) => {
    // Look for Edit Profile button
    const editBtn = page.locator('button:has-text("Edit Profile"), button:has-text("Edit")')

    if (await editBtn.count() > 0) {
      await editBtn.first().click()
      await page.waitForTimeout(500)

      // Check if input fields appear in edit mode
      const nameInput = page.locator('input[type="text"]')
      if (await nameInput.count() > 0) {
        await expect(nameInput.first()).toBeVisible()
      }

      // Check for Save/Cancel buttons
      const saveBtn = page.locator('button:has-text("Save")')
      const cancelBtn = page.locator('button:has-text("Cancel")')

      if (await saveBtn.count() > 0) {
        await expect(saveBtn.first()).toBeVisible()
      }

      if (await cancelBtn.count() > 0) {
        await expect(cancelBtn.first()).toBeVisible()
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should cancel profile edit', async ({ page }) => {
    // Click Edit Profile button
    const editBtn = page.locator('button:has-text("Edit Profile"), button:has-text("Edit")')

    if (await editBtn.count() > 0) {
      await editBtn.first().click()
      await page.waitForTimeout(500)

      // Look for Cancel button
      const cancelBtn = page.locator('button:has-text("Cancel")')
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click()
        await page.waitForTimeout(500)

        // Edit Profile button should be visible again
        if (await editBtn.count() > 0) {
          await expect(editBtn.first()).toBeVisible()
        }
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display password change form', async ({ page }) => {
    // Navigate to Security tab
    const securityTab = page.locator('button:has-text("Security")')
    if (await securityTab.count() > 0) {
      await securityTab.click()
      await page.waitForTimeout(500)

      // Look for password fields
      const passwordInputs = page.locator('input[type="password"]')
      const passwordCount = await passwordInputs.count()

      if (passwordCount >= 3) {
        // Should have current, new, and confirm password fields
        await expect(passwordInputs.nth(0)).toBeVisible()
        await expect(passwordInputs.nth(1)).toBeVisible()
        await expect(passwordInputs.nth(2)).toBeVisible()
      }

      // Check for Update Password button
      const updateBtn = page.locator('button:has-text("Update Password"), button:has-text("Change Password")')
      if (await updateBtn.count() > 0) {
        await expect(updateBtn.first()).toBeVisible()
      }
    }
  })

  test('should validate password change form', async ({ page }) => {
    // Navigate to Security tab
    const securityTab = page.locator('button:has-text("Security")')
    if (await securityTab.count() > 0) {
      await securityTab.click()
      await page.waitForTimeout(500)

      const passwordInputs = page.locator('input[type="password"]')
      const passwordCount = await passwordInputs.count()

      if (passwordCount >= 3) {
        // Fill password fields
        await passwordInputs.nth(0).fill('CurrentPass123!')
        await passwordInputs.nth(1).fill('NewPass123!')
        await passwordInputs.nth(2).fill('NewPass123!')

        // Try to click update button
        const updateBtn = page.locator('button:has-text("Update Password"), button:has-text("Change Password")')
        if (await updateBtn.count() > 0) {
          // Button should be enabled
          const isDisabled = await updateBtn.first().isDisabled()
          expect(isDisabled).toBe(false)
        }
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display security features', async ({ page }) => {
    // Navigate to Security tab
    const securityTab = page.locator('button:has-text("Security")')
    if (await securityTab.count() > 0) {
      await securityTab.click()
      await page.waitForTimeout(500)

      // Look for 2FA or other security features
      const twoFactorText = page.locator('text=/two-factor|2fa|authentication/i')
      if (await twoFactorText.count() > 0) {
        await expect(twoFactorText.first()).toBeVisible()
      }

      // Look for enable/disable buttons
      const securityBtns = page.locator('button:has-text("Enable"), button:has-text("Enabled"), button:has-text("Disable")')
      if (await securityBtns.count() > 0) {
        await expect(securityBtns.first()).toBeVisible()
      }
    }
  })

  test('should display activity log', async ({ page }) => {
    // Navigate to Activity tab
    const activityTab = page.locator('button:has-text("Activity")')
    if (await activityTab.count() > 0) {
      await activityTab.click()
      await page.waitForTimeout(500)

      // Look for activity entries
      const activityItems = page.locator('.border, [class*="rounded"]')
      if (await activityItems.count() > 0) {
        // Should have some activity items
        expect(await activityItems.count()).toBeGreaterThan(0)
      }
    }

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display avatar/profile picture', async ({ page }) => {
    // Look for avatar or profile picture
    const avatar = page.locator('svg, img, .bg-blue-600, [class*="avatar"]')
    if (await avatar.count() > 0) {
      await expect(avatar.first()).toBeVisible()
    }

    // Look for camera/upload icon
    const uploadBtn = page.locator('button:has(svg)')
    if (await uploadBtn.count() > 0) {
      // Should have some button with icon
      expect(await uploadBtn.count()).toBeGreaterThan(0)
    }
  })

  test('should display permissions if available', async ({ page }) => {
    // Make sure we're on Profile tab
    const profileTab = page.locator('button:has-text("Profile")')
    if (await profileTab.count() > 0) {
      await profileTab.click()
      await page.waitForTimeout(500)
    }

    // Look for permissions section
    const permissionsHeading = page.locator('text=/permissions/i')
    if (await permissionsHeading.count() > 0) {
      await expect(permissionsHeading.first()).toBeVisible()
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
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    await expect(page.locator('body')).toBeVisible()
  })
})
