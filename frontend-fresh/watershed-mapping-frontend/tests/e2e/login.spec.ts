import { test, expect } from '@playwright/test'
import { TEST_USERS, login, logout, isAuthenticated } from '../fixtures/auth'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('should display login page', async ({ page }) => {
    await page.goto('/login')

    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    // Enter invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Wait for error message
    await page.waitForTimeout(1000)

    // Should still be on login page
    expect(page.url()).toContain('/login')
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    const adminUser = TEST_USERS.admin

    await page.goto('/login')
    await page.fill('input[type="email"]', adminUser.email)
    await page.fill('input[type="password"]', adminUser.password)
    await page.click('button[type="submit"]')

    // Wait for navigation
    await page.waitForURL(/\/(dashboard|map)/, { timeout: 10000 })

    // Verify we're authenticated
    const authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(true)

    // Verify we're not on login page
    expect(page.url()).not.toContain('/login')
  })

  test('should store token in localStorage after login', async ({ page }) => {
    await login(page, TEST_USERS.admin)

    // Check that token is stored
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
  })

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard without being logged in
    await page.goto('/dashboard')

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test.skip('should logout successfully', async ({ page }) => {
    // First login
    await login(page, TEST_USERS.admin)

    // Verify logged in
    let authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(true)

    // Logout
    await logout(page)

    // Verify logged out
    authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(false)

    // Should be on login page
    expect(page.url()).toContain('/login')
  })

  test('should persist session on page reload', async ({ page }) => {
    // Login
    await login(page, TEST_USERS.admin)

    // Get current URL
    const currentUrl = page.url()

    // Reload page
    await page.reload()

    // Should still be authenticated and on same page
    const authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(true)
    expect(page.url()).toBe(currentUrl)
  })

  test('should handle session expiry gracefully', async ({ page }) => {
    // Login
    await login(page, TEST_USERS.admin)

    // Clear token to simulate expiry
    await page.evaluate(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
    })

    // Try to navigate to a protected route
    await page.goto('/dashboard')

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })
})
