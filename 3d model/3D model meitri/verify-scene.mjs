// Headless smoke test: loads the built app in Edge/Chrome (headless),
// collects console errors + page errors, verifies orbit controls respond,
// and captures screenshots for visual inspection.
import { chromium } from 'playwright-core'

const url = process.env.SCENE_URL ?? 'http://localhost:4173/'
const errors = []

let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
} catch {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
})

await page.goto(url, { waitUntil: 'load', timeout: 45000 })
await page.waitForSelector('canvas', { timeout: 20000 })
await page.waitForTimeout(7000)

await page.screenshot({ path: 'shot-1-overview.png' })

// Orbit: left-drag horizontally
await page.mouse.move(720, 450)
await page.mouse.down()
for (let i = 1; i <= 12; i++) await page.mouse.move(720 + i * 18, 450 - i * 4)
await page.mouse.up()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shot-2-orbited.png' })

// Zoom: wheel
await page.mouse.wheel(0, -900)
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shot-3-zoomed.png' })

// Hover highlight over a station structure (screen centre = main building)
await page.mouse.move(720, 430)
await page.waitForTimeout(1200)
const cursor = await page.evaluate(() => document.body.style.cursor)
await page.mouse.move(721, 431) // nudge so pointerout/over state settles
await page.waitForTimeout(400)
await page.screenshot({ path: 'shot-4-hover.png' })

// Phase 2: 3D click on the station structure at screen centre -> detail panel
// (must run before any dashboard-driven camera focus moves)
await page.mouse.click(720, 430)
await page.waitForSelector('.detail-panel', { timeout: 5000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shot-5-selected-3d.png' })

// Deselect via Escape, then select a system from the dashboard rail -> camera focus
await page.keyboard.press('Escape')
await page.waitForSelector('.detail-panel[data-system-id]', { state: 'detached', timeout: 5000 })
await page.click('.system-row:has-text("Fuel Station")')
await page.waitForSelector('.detail-panel[data-system-id="BharatiFuelStation"]', { timeout: 5000 })
await page.waitForTimeout(2500) // allow camera focus lerp
await page.screenshot({ path: 'shot-6-selected-rail.png' })

// Phase 3: keyboard cycling (ArrowRight -> next system = Seawater & Water Pumps)
await page.keyboard.press('ArrowRight')
await page.waitForSelector('.detail-panel[data-system-id="BharatiWaterPump"]', { timeout: 5000 })

// Number hotkey jump -> 1 = Main Building, then hover-sync between 3D and rail
await page.keyboard.press('Digit1')
await page.waitForSelector('.detail-panel[data-system-id="BharatiMainBuilding"]', { timeout: 5000 })
await page.waitForTimeout(2200) // allow glide to frame the building
await page.mouse.move(720, 430)
await page.waitForTimeout(900)
await page.mouse.move(721, 431)
await page.waitForTimeout(400)
const hoverSync = await page.evaluate(() => {
  const row = document.querySelector('.system-row.is-hovered')
  return row ? row.textContent.trim() : null
})
await page.screenshot({ path: 'shot-7-hover-sync.png' })

// Escape -> deselect + cinematic glide back to the default campus overview
await page.keyboard.press('Escape')
await page.waitForSelector('.detail-panel[data-system-id]', { state: 'detached', timeout: 5000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: 'shot-8-overview-reset.png' })

// Reset button path: select via rail, then RESET VIEW button
await page.click('.system-row:has-text("Utility")')
await page.waitForSelector('.detail-panel[data-system-id="BharatiUtilityArea"]', { timeout: 5000 })
await page.waitForTimeout(1800)
await page.click('.reset-btn')
await page.waitForSelector('.detail-panel[data-system-id]', { state: 'detached', timeout: 5000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'shot-9-reset-btn.png' })

// Phase 4: thermal IR mode + calibration legend
await page.click('.mode-btn:has-text("THERMAL IR")')
await page.waitForSelector('.thermal-legend', { timeout: 5000 })
await page.waitForTimeout(1800) // material tint transition
await page.screenshot({ path: 'shot-10-thermal.png' })

// Utility flow mode: animated conduits
await page.click('.mode-btn:has-text("UTILITY FLOW")')
await page.waitForTimeout(1600)
await page.screenshot({ path: 'shot-11-flows.png' })

// Scenario simulator: inject CRITICAL fault into the Fuel Farm
await page.click('.sim-toggle')
await page.selectOption('.sim-row:has-text("Fuel Farm") select', 'critical')
await page.waitForTimeout(900)
const fuelBadge = await page.evaluate(() => {
  const row = Array.from(document.querySelectorAll('.system-row')).find((r) =>
    r.textContent.includes('Fuel Farm'),
  )
  return row?.querySelector('.row-badge')?.textContent.trim() ?? null
})
await page.screenshot({ path: 'shot-12-critical-fault.png' })

// Polar night, then blizzard whiteout
await page.click('.mode-btn:has-text("POLAR NIGHT")')
await page.waitForTimeout(1800)
await page.screenshot({ path: 'shot-13-night.png' })
await page.click('.mode-btn:has-text("BLIZZARD")')
await page.waitForTimeout(2400)
await page.screenshot({ path: 'shot-14-blizzard.png' })

// Restore defaults: standard mode, clear weather, clear injected faults
await page.click('.mode-btn:has-text("STANDARD VIEW")')
await page.click('.mode-btn:has-text("BLIZZARD")')
await page.click('.sim-reset')
await page.waitForTimeout(1500)

// Phase 5: mission header populated by the 1 Hz pipeline
await page.waitForSelector('.mission-header', { timeout: 5000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: 'shot-15-mission-header.png' })

// Preset C: fuel pipeline leak -> automatic CRITICAL alerts
await page.click('.sim-preset:has-text("FUEL PIPELINE LEAK")')
await page.waitForTimeout(2800)
const headerStats = await page.evaluate(() => ({
  alarms: document.querySelector('.mh-alarms')?.textContent.trim() ?? null,
  weather: document.querySelector('.mh-weather')?.textContent.trim() ?? null,
  health: document.querySelector('.mh-gauge text')?.textContent ?? null,
}))
await page.screenshot({ path: 'shot-16-preset-leak.png' })

// Open the alerts drawer
await page.click('.mh-alarms')
await page.waitForSelector('.alerts-drawer.open', { timeout: 5000 })
await page.waitForTimeout(600)
await page.screenshot({ path: 'shot-17-alerts-drawer.png' })

// Locate-in-3D from the first critical alert
await page.click('.alert-row.sev-critical .alert-btn.locate')
await page.waitForSelector('.detail-panel[data-system-id="BharatiFuelFarm"]', { timeout: 5000 })
await page.waitForTimeout(2200)
await page.screenshot({ path: 'shot-18-locate-3d.png' })

// Expand live trend charts (60 s buffer) in the inspection panel
await page.click('.trend-toggle')
await page.waitForTimeout(1800)
await page.screenshot({ path: 'shot-19-trends.png' })

// Preset B: winter deep freeze (blizzard + polar night physics)
await page.click('.sim-preset:has-text("WINTER DEEP FREEZE")')
await page.waitForTimeout(3000)
await page.screenshot({ path: 'shot-20-deep-freeze.png' })

// Preset D: generator bearing degradation
await page.click('.sim-preset:has-text("GEN BEARING WEAR")')
await page.waitForTimeout(2800)
await page.screenshot({ path: 'shot-21-bearing.png' })

// Back to nominal midsummer operations
await page.click('.sim-preset:has-text("NOMINAL MIDSUMMER")')
await page.waitForTimeout(1500)

// Phase 6: AI predictive maintenance tab (RUL cards + correlation patterns)
await page.click('.detail-tab:has-text("AI MAINTENANCE")')
await page.waitForSelector('.ai-card', { timeout: 5000 })
await page.waitForTimeout(900)
await page.screenshot({ path: 'shot-22-ai-maintenance.png' })

// SOP center: preset C arms the fuel-leak protocol
await page.click('.detail-tab:has-text("SOP CENTER")')
await page.click('.sim-preset:has-text("FUEL PIPELINE LEAK")')
await page.waitForSelector('.sop-card', { timeout: 5000 })
await page.waitForTimeout(1500)
const alarmsBeforeSop = await page.evaluate(() =>
  document.querySelector('.mh-alarms')?.textContent.trim() ?? null,
)
await page.screenshot({ path: 'shot-23-sop-center.png' })

// Execute the SOP workflow -> mitigation physics clears the alerts
await page.click('.sop-card .alert-btn.locate')
await page.waitForSelector('.sop-modal', { timeout: 5000 })
await page.click('.sop-actions .alert-btn.locate')
await page.waitForTimeout(4000)
const sopResult = await page.evaluate(() => ({
  alarms: document.querySelector('.mh-alarms')?.textContent.trim() ?? null,
  stepsDone: document.querySelector('.sop-complete')?.textContent.trim() ?? null,
}))
await page.screenshot({ path: 'shot-24-sop-executed.png' })

// Mission Copilot: health query, then a 3D focus command
await page.keyboard.press('Escape')
await page.click('.copilot-launch')
await page.waitForSelector('.copilot', { timeout: 5000 })
await page.fill('.copilot-input', 'What is the current health of the fuel farm?')
await page.press('.copilot-input', 'Enter')
await page.waitForTimeout(700)
const copilotHealth = await page.evaluate(() =>
  document.querySelector('.copilot-msg.copilot .copilot-bubble')?.textContent?.slice(0, 140) ?? null,
)
await page.fill('.copilot-input', 'Focus on the generators')
await page.press('.copilot-input', 'Enter')
await page.waitForTimeout(2400)
const copilotFocus = await page.evaluate(() =>
  document.querySelector('.detail-panel')?.getAttribute('data-system-id'),
)
await page.screenshot({ path: 'shot-25-copilot.png' })

// What-if crisis simulator: push blizzard duration, read the recommendation
await page.click('.mh-tool:has-text("WHAT-IF")')
await page.waitForSelector('.whatif-panel', { timeout: 5000 })
await page.$eval(
  '.whatif-slider input[type=range]',
  (el, v) => {
    el.value = String(v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  },
  12,
)
await page.waitForTimeout(700)
const whatIfRec = await page.evaluate(() =>
  document.querySelector('.whatif-recommendation')?.textContent?.slice(0, 120) ?? null,
)
await page.screenshot({ path: 'shot-26-whatif.png' })
await page.click('.whatif-panel .close-btn')

// Mission briefing report
await page.click('.mh-tool:has-text("BRIEFING")')
await page.waitForSelector('.report-modal', { timeout: 5000 })
await page.waitForTimeout(600)
await page.screenshot({ path: 'shot-27-report.png' })
await page.click('.report-modal .close-btn')

const stats = await page.evaluate(({ hoverCursor, hoverSyncRow, fuelBadge, headerStats, alarmsBeforeSop, sopResult, copilotHealth, copilotFocus, whatIfRec }) => {
  const canvas = document.querySelector('canvas')
  const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')
  const detail = document.querySelector('.detail-panel')
  return {
    hasCanvas: !!canvas,
    canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
    webgl: !!gl,
    title: document.title,
    overlays: Array.from(document.querySelectorAll('.overlay')).map((el) => el.textContent.trim()),
    hoverCursor,
    railRows: document.querySelectorAll('.system-row').length,
    selectedSystemId: detail?.getAttribute('data-system-id') ?? null,
    telemetryCards: detail ? detail.querySelectorAll('.tele-card').length : 0,
    sparklines: detail ? detail.querySelectorAll('.spark').length : 0,
    viewModeChip: document.querySelector('.viewmode-chip')?.textContent.trim() ?? null,
    hoverSyncRow,
    resetBtnDisabled: document.querySelector('.reset-btn')?.disabled ?? null,
    activeMode: document.querySelector('.mode-btn.active')?.textContent.trim() ?? null,
    fuelFarmBadge: fuelBadge,
    simulatorOverrides: document.querySelector('.sim-count')?.textContent.trim() ?? '0',
    missionHeader: headerStats,
    phase6: { alarmsBeforeSop, sopResult, copilotHealth, copilotFocus, whatIfRec },
  }
}, { hoverCursor: cursor, hoverSyncRow: hoverSync, fuelBadge, headerStats, alarmsBeforeSop, sopResult, copilotHealth, copilotFocus, whatIfRec })

console.log(JSON.stringify({ stats, errorCount: errors.length, errors }, null, 2))
await browser.close()
