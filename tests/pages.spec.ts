import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('methodology page states the honesty rules and has no serious a11y issues', async ({ page }) => {
  await page.goto('/methodology')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Method')
  await expect(page.locator('.prose')).toContainText('never converted into an assumed-duration kWh')
  await expect(page.locator('.prose')).toContainText('not an official IIT Roorkee platform')
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([])
})

test('without a backend the audit and review routes explain demo mode instead of failing', async ({ page }) => {
  await page.goto('/audit')
  await expect(page.getByRole('status')).toContainText('demo mode', { timeout: 20000 })
  await page.goto('/login')
  await expect(page.getByRole('status')).toContainText('demo mode', { timeout: 20000 })
  await page.goto('/review')
  await expect(page.getByRole('status')).toContainText('live backend', { timeout: 20000 })
})

test('explorer links reach the method page and unknown routes return home', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Method', exact: true }).click()
  await expect(page).toHaveURL(/\/methodology$/)
  await page.goto('/designs/blueprint?x=1')
  await expect(page).toHaveURL(/\/$/)
})
