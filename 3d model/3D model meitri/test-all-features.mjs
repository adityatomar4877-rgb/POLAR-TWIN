import { chromium } from 'playwright-core'

const url = process.env.SCENE_URL ?? 'http://localhost:4173/'
const errors = []
const results = {
  bharati: {},
  maitri: {},
  features: {},
}

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

console.log('1. Loading application at', url)
await page.goto(url, { waitUntil: 'load', timeout: 45000 })
await page.waitForSelector('canvas', { timeout: 20000 })
await page.waitForTimeout(5000)

// Test 1: Mission Header initial state
console.log('2. Verifying Mission Header...')
const headerState = await page.evaluate(() => {
  return {
    station: document.querySelector('.mh-title select')?.value,
    health: document.querySelector('.mh-gauge text')?.textContent,
    weather: document.querySelector('.mh-weather')?.textContent,
    alarms: document.querySelector('.mh-alarms')?.textContent?.trim(),
  }
})
results.features.missionHeader = headerState
console.log('   Header state:', headerState)

// Test 2: 3D Orbit, Zoom
console.log('3. Testing 3D Orbit & Zoom...')
await page.mouse.move(720, 450)
await page.mouse.down()
for (let i = 1; i <= 10; i++) await page.mouse.move(720 + i * 15, 450 - i * 3)
await page.mouse.up()
await page.waitForTimeout(1000)
await page.mouse.wheel(0, -500)
await page.waitForTimeout(1000)

// Test 3: Hover & Click 3D structure
console.log('4. Testing 3D selection & detail panel...')
await page.click('.system-row:has-text("Fuel Farm")')
await page.waitForSelector('.detail-panel[data-system-id="BharatiFuelFarm"]', { timeout: 5000 })
await page.waitForTimeout(1000)
results.bharati.fuelFarmSelected = true

// Test 4: Detail panel tabs
console.log('5. Testing Telemetry & Trend charts...')
await page.click('.trend-toggle')
await page.waitForSelector('.trend-list', { timeout: 3000 })
const trendCount = await page.evaluate(() => document.querySelectorAll('.trend-chart').length)
results.features.trendChartCount = trendCount
console.log('   Trend charts count:', trendCount)

console.log('6. Testing AI Maintenance Tab...')
await page.click('.detail-tab:has-text("AI MAINTENANCE")')
await page.waitForSelector('.ai-card', { timeout: 5000 })
const rulCards = await page.evaluate(() => document.querySelectorAll('.ai-card').length)
results.features.aiCardsCount = rulCards
console.log('   AI cards count:', rulCards)

console.log('7. Testing SOP Center Tab...')
await page.click('.detail-tab:has-text("SOP CENTER")')
await page.waitForSelector('.sop-tab', { timeout: 5000 })
results.features.sopCenterLoaded = true

// Test 5: Visual Modes & Weather
console.log('8. Testing View Modes (Thermal, Utility, Night, Blizzard)...')
await page.click('.mode-btn:has-text("THERMAL IR")')
await page.waitForSelector('.thermal-legend', { timeout: 3000 })
results.features.thermalMode = true

await page.click('.mode-btn:has-text("UTILITY FLOW")')
await page.waitForSelector('.utility-legend', { timeout: 3000 })
results.features.utilityFlowMode = true

await page.click('.mode-btn:has-text("POLAR NIGHT")')
await page.waitForTimeout(1000)
results.features.polarNightMode = true

await page.click('.mode-btn:has-text("BLIZZARD")')
await page.waitForTimeout(1000)
results.features.blizzardWeather = true

// Reset to standard
await page.click('.mode-btn:has-text("STANDARD VIEW")')
await page.click('.mode-btn:has-text("BLIZZARD")')
await page.waitForTimeout(1000)

// Test 6: Mission Copilot
console.log('9. Testing Mission Copilot...')
await page.click('.copilot-launch')
await page.waitForSelector('.copilot', { timeout: 3000 })
await page.fill('.copilot-input', 'What is the fuel autonomy?')
await page.press('.copilot-input', 'Enter')
await page.waitForTimeout(1000)
const copilotReply = await page.evaluate(() => {
  const bubbles = document.querySelectorAll('.copilot-msg.copilot .copilot-bubble')
  return bubbles[bubbles.length - 1]?.textContent
})
results.features.copilotReply = copilotReply?.slice(0, 100)
console.log('   Copilot reply:', results.features.copilotReply)

// Test 3D focus via copilot
await page.fill('.copilot-input', 'Focus on the main building')
await page.press('.copilot-input', 'Enter')
await page.waitForTimeout(2000)
const focusedSystem = await page.evaluate(() => document.querySelector('.detail-panel')?.getAttribute('data-system-id'))
results.features.copilotFocusSystem = focusedSystem
console.log('   Copilot focused system:', focusedSystem)
await page.keyboard.press('Escape') // close copilot
await page.waitForTimeout(500)

// Test 7: What-If Crisis Simulator
console.log('10. Testing What-If Crisis Simulator...')
await page.click('.mh-tool:has-text("WHAT-IF")')
await page.waitForSelector('.whatif-panel', { timeout: 3000 })
const whatifRec = await page.evaluate(() => document.querySelector('.whatif-recommendation')?.textContent)
results.features.whatIfRecommendation = whatifRec?.slice(0, 100)
console.log('   What-if recommendation:', results.features.whatIfRecommendation)
await page.click('.whatif-panel .close-btn')

// Test 8: Mission Briefing Report Modal
console.log('11. Testing Mission Briefing Report Modal...')
await page.click('.mh-tool:has-text("BRIEFING")')
await page.waitForSelector('.report-modal', { timeout: 3000 })
const reportTitle = await page.evaluate(() => document.querySelector('.report-doc h1')?.textContent)
results.features.reportTitle = reportTitle
console.log('   Report title:', reportTitle)
await page.click('.report-modal .close-btn')

// Test 9: Scenario Simulator Presets & Fault Injection
console.log('12. Testing Scenario Simulator Presets...')
await page.click('.sim-toggle')
await page.waitForSelector('.sim-body', { timeout: 3000 })
await page.click('.sim-preset:has-text("FUEL PIPELINE LEAK")')
await page.waitForTimeout(2500)
const leakAlarms = await page.evaluate(() => document.querySelector('.mh-alarms')?.textContent?.trim())
results.features.leakPresetAlarms = leakAlarms
console.log('   Alarms under leak preset:', leakAlarms)

// Test 10: Alerts Drawer & SOP Workflow Execution
console.log('13. Testing Alerts Drawer & SOP Execution...')
await page.click('.mh-alarms')
await page.waitForSelector('.alerts-drawer.open', { timeout: 3000 })
const alertRows = await page.evaluate(() => document.querySelectorAll('.alert-row').length)
results.features.activeAlertCount = alertRows
console.log('   Alert count in drawer:', alertRows)
await page.click('.alerts-drawer .close-btn')
await page.waitForTimeout(500)

// Open SOP and execute mitigation
await page.click('.detail-tab:has-text("SOP CENTER")')
await page.waitForSelector('.sop-card', { timeout: 4000 })
await page.click('.sop-card .alert-btn.locate')
await page.waitForSelector('.sop-modal', { timeout: 3000 })
await page.click('.sop-actions .alert-btn.locate') // execute automated steps
await page.waitForTimeout(3000)
const sopComplete = await page.evaluate(() => document.querySelector('.sop-complete')?.textContent?.trim())
results.features.sopCompleteMessage = sopComplete
console.log('   SOP Execution Result:', sopComplete)
await page.keyboard.press('Escape')
if (await page.isVisible('.sim-reset')) {
  await page.click('.sim-reset')
}
if (await page.isVisible('.simulator.open')) {
  await page.click('.sim-toggle')
}
await page.waitForTimeout(1000)

// Test 11: Switch to MAITRI Station
console.log('14. Testing Switch to MAITRI Station...')
await page.selectOption('.mh-title select', 'maitri')
await page.waitForTimeout(3000)
const maitriState = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('.system-row')).map((r) => r.textContent.trim())
  const canvas = document.querySelector('canvas')
  const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')
  return {
    station: document.querySelector('.mh-title select')?.value,
    railRows: rows,
    webgl: !!gl,
  }
})
results.maitri = maitriState
console.log('   Maitri state:', maitriState)

// Select a Maitri system
await page.click('.system-row:has-text("Maitri Main Building")')
await page.waitForSelector('.detail-panel[data-system-id="MaitriMainBuilding"]', { timeout: 5000 })
await page.click('.detail-tab:has-text("TELEMETRY")')
await page.waitForTimeout(1000)
const maitriDetail = await page.evaluate(() => ({
  id: document.querySelector('.detail-panel')?.getAttribute('data-system-id'),
  title: document.querySelector('.detail-title')?.textContent,
  teleCards: document.querySelectorAll('.tele-card').length,
}))
results.maitri.detailPanel = maitriDetail
console.log('   Maitri detail panel:', maitriDetail)

// Test keyboard cycling on Maitri
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(1000)
const nextMaitri = await page.evaluate(() => document.querySelector('.detail-panel')?.getAttribute('data-system-id'))
results.maitri.cycledSystemId = nextMaitri
console.log('   Maitri cycled system:', nextMaitri)

// Reset view on Maitri
await page.click('.reset-btn')
await page.waitForTimeout(1500)
const isCleared = await page.evaluate(() => !document.querySelector('.detail-panel[data-system-id]'))
results.maitri.resetOverview = isCleared
console.log('   Maitri reset to overview:', isCleared)

// Switch back to Bharati
await page.selectOption('.mh-title select', 'bharati')
await page.waitForTimeout(2000)

console.log('15. ALL TESTS COMPLETED SUCCESSFULLY!')
console.log('SUMMARY RESULTS:', JSON.stringify(results, null, 2))
console.log('ERROR COUNT:', errors.length)
if (errors.length > 0) {
  console.error('Errors encountered:', errors)
}

await browser.close()
