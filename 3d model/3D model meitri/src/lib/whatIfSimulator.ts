// "What-If" crisis simulation & logistics planner (Phase 6).
// Deterministic daily-resolution forecast of consumables under user-defined
// crisis parameters, with an AI-style mitigation recommendation.

import { PLANT } from './stationSystems'
import type { PredictiveMetrics } from './predictiveEngine'

export interface WhatIfParams {
  /** Blizzard duration at the start of the forecast (days). */
  blizzardDays: number
  /** Next resupply vessel ETA (days from now). */
  vesselDelayDays: number
  /** Fleet-wide generator efficiency loss (%). */
  genEfficiencyLossPct: number
  /** Camp occupancy surge (personnel). */
  campOccupancy: number
}

export const WHAT_IF_DEFAULTS: WhatIfParams = {
  blizzardDays: 5,
  vesselDelayDays: 45,
  genEfficiencyLossPct: 10,
  campOccupancy: 24,
}

export interface WhatIfPoint {
  day: number
  fuelPercent: number
  waterPercent: number
  blizzard: boolean
}

export interface WhatIfResult {
  points: WhatIfPoint[]
  fuelDepletionDay: number | null
  waterDeficitDay: number | null
  resupplyShortfallDays: number | null
  powerMarginPct: number
  powerMarginOk: boolean
  recommendation: string
  rationingSavingsDays: number
}

const FORECAST_HORIZON_DAYS = 120

export function simulateWhatIf(
  params: WhatIfParams,
  baseline: PredictiveMetrics,
): WhatIfResult {
  // Current per-hour burn implied by the live runway, scaled by scenario stress.
  const currentBurnLph =
    (PLANT.fuelTankLiters * 0.78) / Math.max(24, baseline.fuelHours)
  const occupancyFactor = 1 + Math.max(0, params.campOccupancy - 24) * 0.012
  const blizzardBurnFactor = 2.35
  const effFactor = 1 + params.genEfficiencyLossPct / 100

  const water0 = baseline.waterReservePercent
  const waterUsePerDay =
    (PLANT.waterConsumptionLph * 24) / (PLANT.waterTankLiters / 100) *
    (1 + Math.max(0, params.campOccupancy - 24) * 0.02)

  const points: WhatIfPoint[] = []
  let fuel = 78 // start from catalog-typical level; refined by runway below
  // Anchor the starting fuel to the live runway so the forecast tracks reality.
  const liveFuelPercent = Math.min(
    95,
    (baseline.fuelHours * currentBurnLph * 100) / PLANT.fuelTankLiters,
  )
  fuel = liveFuelPercent
  let water = water0
  let fuelDepletionDay: number | null = null
  let waterDeficitDay: number | null = null

  for (let day = 0; day <= FORECAST_HORIZON_DAYS; day++) {
    points.push({ day, fuelPercent: fuel, waterPercent: water, blizzard: day < params.blizzardDays })
    const burnPerDay =
      currentBurnLph * 24 * (day < params.blizzardDays ? blizzardBurnFactor : 1) *
      effFactor * occupancyFactor
    fuel = fuel - (burnPerDay / PLANT.fuelTankLiters) * 100
    water = water - (day < params.blizzardDays ? waterUsePerDay * 1.35 : waterUsePerDay)
    if (fuel <= 0 && fuelDepletionDay === null) fuelDepletionDay = day
    if (water <= 0 && waterDeficitDay === null) waterDeficitDay = day
    if (fuel <= 0 && water <= 0) break
    fuel = Math.max(0, fuel)
    water = Math.max(0, water)
  }

  const resupplyShortfallDays =
    fuelDepletionDay !== null ? fuelDepletionDay - params.vesselDelayDays : null

  // Power margin: capacity derated by efficiency loss vs blizzard-heated demand.
  const capacity = PLANT.gensetCount * PLANT.gensetKw * (1 - params.genEfficiencyLossPct / 100)
  const peakDemand = baseline.stationLoadKw * (params.blizzardDays > 0 ? 1.55 : 1.1)
  const powerMarginPct = Math.max(0, ((capacity - peakDemand) / capacity) * 100)
  const powerMarginOk = capacity >= peakDemand * 1.05

  // Rationing recommendation: camp heat reduced to 14°C cuts heating ~28%.
  const rationingFactor = 0.72
  const rationedDepletion = computeDepletionDay(
    liveFuelPercent,
    currentBurnLph,
    params,
    effFactor,
    occupancyFactor * rationingFactor,
  )
  const rationingSavingsDays =
    fuelDepletionDay !== null && rationedDepletion !== null
      ? Math.max(0, rationedDepletion - fuelDepletionDay)
      : 0

  let recommendation: string
  if (fuelDepletionDay !== null && fuelDepletionDay < params.vesselDelayDays) {
    recommendation =
      `Rationing Mode Required: fuel depletes day ${fuelDepletionDay}, ` +
      `${Math.max(0, params.vesselDelayDays - fuelDepletionDay)} day(s) before the vessel arrives. ` +
      `Reduce Summer Camp heat to 14°C to extend fuel runway by ~${rationingSavingsDays} days` +
      (powerMarginOk ? '' : ' and shed non-essential experimental loads immediately') +
      `.`
  } else if (waterDeficitDay !== null && waterDeficitDay < params.vesselDelayDays) {
    recommendation =
      `Critical Water Deficit at day ${waterDeficitDay}. Enforce 2.5 L/person/day rationing and ` +
      `prioritize RO membrane backflush before the intake freezes.`
  } else if (!powerMarginOk) {
    recommendation =
      `Power margin critical at ${powerMarginPct.toFixed(0)}% under generator efficiency loss — ` +
      `defer high-draw science operations until genset efficiency is restored.`
  } else {
    recommendation =
      `Station survives the scenario: fuel holds ${fuelDepletionDay === null ? 'beyond the 120-day horizon' : `to day ${fuelDepletionDay}`} ` +
      `against resupply on day ${params.vesselDelayDays}. No rationing required.`
  }

  return {
    points,
    fuelDepletionDay,
    waterDeficitDay,
    resupplyShortfallDays,
    powerMarginPct: Math.round(powerMarginPct),
    powerMarginOk,
    recommendation,
    rationingSavingsDays,
  }
}

function computeDepletionDay(
  fuelPercent: number,
  currentBurnLph: number,
  params: WhatIfParams,
  effFactor: number,
  occupancyFactor: number,
): number | null {
  let fuel = fuelPercent
  for (let day = 0; day <= FORECAST_HORIZON_DAYS; day++) {
    const burnPerDay =
      currentBurnLph * 24 * (day < params.blizzardDays ? 2.35 : 1) * effFactor * occupancyFactor
    fuel -= (burnPerDay / PLANT.fuelTankLiters) * 100
    if (fuel <= 0) return day
  }
  return null
}
