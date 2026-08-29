// Predictive logistics & runway metrics (Phase 5).
// Computes the station composite health index, fuel autonomy runway, power
// grid balance with N+1 verification, and water reserve autonomy — all from
// the live coupled telemetry snapshot.

import { PLANT } from './stationSystems'
import { missionEngine, type EnvironmentState } from './telemetry'
import { useStationStore } from './stationStore'

export interface PredictiveMetrics {
  /** Station composite health index 0-100. */
  healthIndex: number
  powerStability: number
  lifeSupport: number
  environmentalRisk: number
  commsIntegrity: number
  /** Fuel autonomy in remaining operational hours. */
  fuelHours: number
  fuelDaysLabel: string
  /** Grid balance. */
  generationCapacityKw: number
  stationLoadKw: number
  reserveHeadroomKw: number
  nPlusOneOk: boolean
  /** Water autonomy hours if intake is interrupted. */
  waterReservePercent: number
  waterAutonomyHours: number
}

const clamp01 = (v: number) => Math.max(0, Math.min(100, v))

function bandScore(value: number, low: number, high: number, span: number): number {
  if (value < low) return clamp01(100 - ((low - value) / span) * 100)
  if (value > high) return clamp01(100 - ((value - high) / span) * 100)
  return 100
}

export function computePredictiveMetrics(_env: EnvironmentState): PredictiveMetrics {
  const g = (sys: string, key: string) => missionEngine.getValue(sys, key)
  const isMaitri = useStationStore.getState().activeStation === 'maitri'
  const utilId = isMaitri ? 'MaitriUtilityArea' : 'BharatiUtilityArea'
  const mainId = isMaitri ? 'MaitriMainBuilding' : 'BharatiMainBuilding'
  const campId = isMaitri ? 'MaitriSummerCamp' : 'BharatiSummerCamp'
  const waterId = isMaitri ? 'MaitriLakeWaterPumpHouse' : 'BharatiWaterPump'
  const fuelId = isMaitri ? 'MaitriFuelFarm' : 'BharatiFuelFarm'

  // ---- Sub-scores ----
  const genOutput = g(utilId, 'genOutput')
  const vibration = isMaitri ? 1.4 : g('BharatiUtilityArea', 'vibration')
  const egt = g(utilId, 'exhaustTemp')
  const lube = isMaitri ? 3.1 : g('BharatiUtilityArea', 'lubeOil')
  const powerStability = clamp01(
    bandScore(genOutput, 50, 300, 200) * 0.4 +
      bandScore(vibration, 0, 4.2, 5) * 0.3 +
      bandScore(egt, 40, 85, 40) * 0.2 +
      bandScore(lube, 2.4, 5, 2.5) * 0.1,
  )

  const co2 = g(mainId, 'co2')
  const indoor = g(mainId, 'indoorTemp')
  const air = isMaitri ? 1012 : g('BharatiMainBuilding', 'airPressure')
  const campTemp = g(campId, 'campTemp')
  const lifeSupport = clamp01(
    bandScore(co2, 420, 900, 600) * 0.45 +
      bandScore(indoor, 18, 22, 6) * 0.25 +
      bandScore(air, 995, 1030, 40) * 0.15 +
      bandScore(campTemp, 12, 24, 12) * 0.15,
  )

  const trace = g(waterId, 'traceTemp')
  const icing = isMaitri ? 12 : g('BharatiContainerModules', 'hullIcing')
  const strain = g(mainId, 'hullStrain')
  const environmentalRisk = clamp01(
    bandScore(trace, 3, 20, 10) * 0.4 +
      bandScore(icing, 0, 55, 60) * 0.3 +
      bandScore(strain, 0, 380, 350) * 0.3,
  )

  const snr = isMaitri ? 9.2 : g('BharatiMainBuilding', 'satcomSnr')
  const latency = isMaitri ? 260 : g('BharatiMainBuilding', 'satcomLatency')
  const commsIntegrity = clamp01(
    bandScore(snr, 6, 14, 8) * 0.6 + bandScore(latency, 120, 800, 1200) * 0.4,
  )

  const healthIndex = Math.round(
    powerStability * 0.3 + lifeSupport * 0.3 + environmentalRisk * 0.25 + commsIntegrity * 0.15,
  )

  // ---- Fuel autonomy runway ----
  const tankLevel = g(fuelId, 'tankLevel')
  const burnLph = Math.max(4, isMaitri ? 16 : g('BharatiFuelFarm', 'burnRate'))
  const capacityLiters = isMaitri ? 80_000 : PLANT.fuelTankLiters
  const liters = (tankLevel / 100) * capacityLiters
  const fuelHours = liters / burnLph
  const days = Math.floor(fuelHours / 24)
  const hours = Math.floor(fuelHours % 24)
  const fuelDaysLabel = fuelHours > 96 ? `${days} Days ${hours} h` : `${Math.floor(fuelHours)} h ${Math.round((fuelHours % 1) * 60)} m`

  // ---- Power grid balance ----
  const generationCapacityKw = isMaitri ? 240 : PLANT.gensetCount * PLANT.gensetKw
  const stationLoadKw = genOutput
  const reserveHeadroomKw = generationCapacityKw - stationLoadKw
  const nPlusOneOk = isMaitri ? stationLoadKw <= 160 : stationLoadKw <= (PLANT.gensetCount - 1) * PLANT.gensetKw

  // ---- Water autonomy ----
  const waterReservePercent = isMaitri ? 86 : g('BharatiWaterPump', 'freshReserve')
  const waterTankCapacity = isMaitri ? 50_000 : PLANT.waterTankLiters
  const waterLiters = (waterReservePercent / 100) * waterTankCapacity
  const waterAutonomyHours = waterLiters / PLANT.waterConsumptionLph

  return {
    healthIndex,
    powerStability: Math.round(powerStability),
    lifeSupport: Math.round(lifeSupport),
    environmentalRisk: Math.round(environmentalRisk),
    commsIntegrity: Math.round(commsIntegrity),
    fuelHours,
    fuelDaysLabel,
    generationCapacityKw,
    stationLoadKw: Math.round(stationLoadKw),
    reserveHeadroomKw: Math.round(reserveHeadroomKw),
    nPlusOneOk,
    waterReservePercent,
    waterAutonomyHours,
  }
}

/** Short human summary of the current weather physics state. */
export function weatherSummary(env: EnvironmentState): string {
  return `${env.label} · ${env.ambientTemp.toFixed(0)}°C · ${env.windKts.toFixed(0)} kts`
}
