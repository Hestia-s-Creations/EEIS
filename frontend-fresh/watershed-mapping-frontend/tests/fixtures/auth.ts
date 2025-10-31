import { Page } from '@playwright/test'

export interface TestUser {
  email: string
  password: string
  name: string
  role: string
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    email: 'newadmin@test.com',
    password: 'Admin123@test',
    name: 'Admin User',
    role: 'admin'
  }
}

export async function login(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')

  // Wait for navigation to complete
  await page.waitForURL(/\/(dashboard|map)/, { timeout: 10000 })
}

export async function logout(page: Page) {
  // First, open the profile menu by clicking the user button
  const userButton = page.locator('button').filter({ has: page.locator('svg').first() }).filter({ hasText: /profile|account/i }).or(
    page.locator('button:has(div.bg-blue-600.rounded-full)')
  )

  await userButton.first().click({ timeout: 5000 })

  // Wait for dropdown to appear
  await page.waitForTimeout(500)

  // Click the "Sign Out" button in the dropdown - use force to bypass any overlays
  await page.click('button:has-text("Sign Out")', { timeout: 10000, force: true })

  // Wait for redirect to login - ProtectedRoute needs time to detect state change
  await page.waitForURL('/login', { timeout: 10000 })
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  return token !== null
}
