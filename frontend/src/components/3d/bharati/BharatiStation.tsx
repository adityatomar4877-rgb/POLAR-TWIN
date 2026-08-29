import { BharatiMainBuilding } from './BharatiMainBuilding'
import { BharatiFuelFarm } from './BharatiFuelFarm'
import { BharatiFuelStation } from './BharatiFuelStation'
import { BharatiWaterSystem } from './BharatiWaterSystem'
import { BharatiSummerCamp } from './BharatiSummerCamp'
import { BharatiContainerModules } from './BharatiContainerModules'
import { BharatiUtilityArea } from './BharatiUtilityArea'

/**
 * Root of the station campus. Every facility is a separate named group
 * so later phases can bind telemetry and interaction per system.
 */
export function BharatiStation() {
  return (
    <group name="BharatiStation" userData={{ stationId: 'BharatiStation' }}>
      <BharatiMainBuilding />
      <BharatiFuelFarm />
      <BharatiFuelStation />
      <BharatiWaterSystem />
      <BharatiSummerCamp />
      <BharatiContainerModules />
      <BharatiUtilityArea />
    </group>
  )
}
