import { test, expect } from '@playwright/test'
const heroBuildings=[
  {id:'lhc',name:'Lecture Hall Complex',floors:4},
  {id:'mgcl',name:'Mahatma Gandhi Central Library',floors:4},
  {id:'mac',name:'Multi Activity Centre',floors:4},
  {id:'sac',name:'Students Activity Centre',floors:4},
]

test('mapped hero shapes retain their rings when separated and reassembled', async ({ page }) => {
  await page.goto('/')
  for (const b of heroBuildings) {
    const shape = page.locator(`.campus-building[data-building-id="${b.id}"]`)
    await shape.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.evidence-content h2')).toHaveText(b.name)
    await expect(page.getByRole('link', {name:'Map source ↗'})).toHaveAttribute('href', /openstreetmap.org/)
    await page.getByRole('button', {name:'Separate floors',exact:true}).click()
    await expect(shape.locator('[data-geometry="osm-footprint"]')).toHaveCount(b.floors)
    const paths = await shape.locator('[data-geometry="osm-footprint"] > path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')))
    expect(paths.every(p=>p?.includes('L') && !p.includes('NaN'))).toBe(true)
    if(b.id==='mac') expect(paths.every(p=>(p?.match(/M/g)??[]).length===4)).toBe(true)
    await page.getByRole('button',{name:'Reassemble',exact:true}).click()
    await expect(shape.locator('[data-detail]')).toHaveAttribute('data-detail',b.id)
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
