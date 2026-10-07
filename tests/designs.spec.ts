import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

test('Chromatic is the sole interface, including retired bookmarks', async ({ page, request }) => {
  for (const url of ['/', '/designs/chromatic?embed=1', '/designs/blueprint', '/designs/sumi', '/designs/porcelain', '/designs/canopy', '/designs/section', '/designs/signal', '/designs/nightfall', '/designs/playfield', '/designs/waypoint', '/compare?left=blueprint&right=sumi', '/inspirations', '/original']) {
    await page.goto(url)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('See the campus differently.')
    await expect(page.locator('.prototype.direction-chromatic')).toHaveCount(1)
    await expect(page.locator('.concept-card, .preview-browser, .compare-frame, .inspiration-grid')).toHaveCount(0)
  }
  expect((await request.get('/previews/blueprint.webp')).headers()['content-type']).not.toContain('image/')
})

test('keyboard focus, evidence honesty, CSV export and the five-stop tour work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to campus workspace' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#campus-workspace')).toBeFocused()
  await page.locator('.campus-building[data-building-id="mgcl"]').focus()
  await page.keyboard.press('Enter')
  const trigger = page.getByRole('button', { name: /P-004/ })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Expanded case file' })
  await expect(dialog).toContainText('No verified duration')
  await expect(page.getByRole('button', { name: 'Close case file', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Back to campus', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Close case file', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download sample observations CSV' }).click(),
  ])
  const rows = (await readFile((await download.path())!, 'utf8')).trimEnd().split('\n')
  expect(rows).toHaveLength(11)
  expect(rows.find(r=>r.startsWith('P-004,'))?.split(',').at(-1)).toBe('')
  await page.getByRole('button', { name: 'Take a tour' }).click()
  const tour = page.getByRole('region', { name: 'Guided tour' })
  for (const heading of ['Campus audit scope', 'Largest sample hotspot', 'Look between the floors', 'Follow the evening round', 'Three small interventions']) {
    await expect(tour.getByRole('heading')).toHaveText(heading)
    await tour.getByRole('button', { name: heading==='Three small interventions'?'Finish tour':'Next stop' }).click()
  }
  await expect(tour).toHaveCount(0)
})

test('tablet and mobile keep accessible controls and reflow', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(()=>document.fonts.ready)
  for (const width of [820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Take a tour' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show building list' })).toBeVisible()
    const scan = await new AxeBuilder({ page }).include('.prototype').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    expect(scan.violations.filter(v=>v.impact==='critical'||v.impact==='serious').map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([])
    await page.screenshot({ path: `artifacts/designs/chromatic-${width}.png`, fullPage: true })
  }
})

  test('Chromatic: desktop composition, interactions, mobile reflow', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('.evidence-content h2')).toHaveText('Lecture Hall Complex')
    await page.screenshot({ path: `artifacts/designs/chromatic-desktop.png`, fullPage: true })
    await page.locator('.campus-building[aria-label^="Select Mahatma"]').click()
    await expect(page.locator('.evidence-content h2')).toHaveText('Mahatma Gandhi Central Library')
    await page.getByRole('button', { name: /P-004/ }).click()
    await expect(page.locator('.case-detail')).toContainText('No verified duration')
    await expect(page.locator('.case-detail')).toContainText('Not available')
    await page.getByRole('button', { name: 'Close case file', exact: true }).click()
    await page.getByRole('button', { name: 'Show building list', exact: true }).click()
    await page.getByRole('textbox', { name: 'Search buildings', exact: true }).last().fill('LHC')
    await page.locator('.index-popover').getByRole('button', {name:/^LHC Lecture Hall Complex\b/}).click()
    await page.getByRole('button', { name: 'Separate floors', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Reassemble', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('combobox', { name: 'Select floor', exact: true }).selectOption('1')
    await expect(page.locator('.evidence-content')).toContainText('760')
    await page.getByRole('button', { name: /^Morning/ }).click()
    await expect(page.locator('.evidence-content')).toContainText('No sample evidence')
    await page.getByRole('button', { name: 'All times', exact: false }).click()
    await page.getByRole('button', { name: 'Findings', exact: true }).click()
    await expect(page.locator('.findings-surface')).toBeVisible()
    await page.getByRole('button', { name: 'Campus', exact: true }).click()
    await page.getByRole('button', { name: 'Reset campus', exact: true }).click()
    const scan = await new AxeBuilder({ page }).include('.prototype').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    if (scan.violations.length) console.log('Chromatic', JSON.stringify(scan.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))))
    expect(scan.violations.filter(v=>v.impact==='critical'||v.impact==='serious').map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: `artifacts/designs/chromatic-mobile.png`, fullPage: true })
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Show building list', exact: true }).click()
    await page.getByRole('textbox', { name: 'Search buildings', exact: true }).last().fill('no building')
    await expect(page.locator('.index-popover')).toContainText('No matching buildings')
    await page.getByRole('textbox', { name: 'Search buildings', exact: true }).last().fill('SAC')
    await page.locator('.index-popover .index-row').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.evidence-content h2')).toHaveText('Students Activity Centre')
    expect(errors).toEqual([])
  })
