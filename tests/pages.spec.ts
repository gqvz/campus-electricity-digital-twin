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

test('secondary pages scroll when their content is taller than the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  await page.goto('/methodology')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Method')
  const metrics = await page.evaluate(() => {
    const shell = document.querySelector('.page-shell') as HTMLElement
    return { shellHeight: shell.getBoundingClientRect().height, viewport: window.innerHeight, overflow: getComputedStyle(shell).overflowY }
  })
  expect(metrics.overflow).toBe('visible')
  expect(metrics.shellHeight).toBeGreaterThan(metrics.viewport)
  await page.mouse.wheel(0, 2000)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
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

test('terrain relief can be exaggerated and the inspector states ground height', async ({ page }) => {
  await page.goto('/')
  const toggle = page.getByRole('button', { name: 'Exaggerate terrain relief three times' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Reset campus', exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.evidence-content')).toContainText(/Ground about \d+ m above sea level/)
})

test('heatmap button recolours buildings by observed load and explains the scale', async ({ page }) => {
  await page.goto('/')
  const toggle = page.getByRole('button', { name: 'Colour buildings by observed load' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.heat-legend')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('img', { name: /Heatmap legend/ })).toBeVisible()
  await expect(page.locator('.heat-legend')).toContainText('No sample evidence')
  await page.getByRole('button', { name: 'Reset campus', exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

test('evidence figures say what the numbers support', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('.evidence-content')
  await expect(panel).toContainText(/summed over \d+ sighting/)
  await expect(panel).toContainText(/with a verified duration|no energy is claimed/)
  await expect(panel).toContainText('not concurrent demand')
  await expect(panel).toContainText('Unoccupied')
})
