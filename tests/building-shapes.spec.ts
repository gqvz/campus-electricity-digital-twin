import { test, expect } from '@playwright/test'
const heroBuildings=[
  {id:'lhc',name:'Lecture Hall Complex',floors:4},
  {id:'mgcl',name:'Mahatma Gandhi Central Library',floors:4},
  {id:'mac',name:'Multi Activity Centre',floors:4},
  {id:'sac',name:'Students Activity Centre',floors:4},
]

test('hero buildings separate into one slab per floor and reassemble', async ({ page }) => {
  await page.goto('/')
  const scene = page.getByTestId('campus-scene3d')
  for (const b of heroBuildings) {
    await page.getByRole('button', { name: new RegExp('^Select ' + b.name) }).dispatchEvent('click')
    await expect(page.locator('.evidence-content h2')).toHaveText(b.name)
    await expect(scene).toHaveAttribute('data-selected', b.id)
    await expect(page.getByRole('link', { name: 'Map source ↗' })).toHaveAttribute('href', /openstreetmap.org/)
    await expect(scene).toHaveAttribute('data-floor-slices', '0')
    await page.getByRole('button', { name: 'Separate floors', exact: true }).click()
    await expect(scene).toHaveAttribute('data-floor-slices', String(b.floors))
    await page.getByRole('button', { name: 'Reassemble', exact: true }).click()
    await expect(scene).toHaveAttribute('data-floor-slices', '0')
  }
})

test('legacy source dataset and current geometry caveats are publicly accessible', async ({ request }) => {
  const dataset = await request.get('/building-footprints.json')
  expect(dataset.ok()).toBe(true)
  const json=await dataset.json()
  expect(Object.keys(json.footprints)).toHaveLength(12)
  expect(json.license).toBe('ODbL-1.0')
  const note=await request.get('/geometry-sources.txt')
  expect(note.ok()).toBe(true)
  expect(await note.text()).toContain('231')
})
