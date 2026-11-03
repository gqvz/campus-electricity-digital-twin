import type { Page } from '@playwright/test'

/** Artifact screenshots are for humans, not assertions. Software WebGL on CI can stall a full-page capture, so never let one fail a test. */
export async function shot(page: Page, path: string) {
  try { await page.screenshot({ path, fullPage: true, timeout: 20000 }) } catch { /* artifact only */ }
}
