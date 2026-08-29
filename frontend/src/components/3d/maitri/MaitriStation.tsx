import { MAITRI_FACILITIES, maitriTerrainHeight } from '../../../lib/3d/maitriLayout'
import { MaitriMainBuilding } from './MaitriMainBuilding'
import { MaitriFuelFarm } from './MaitriFuelFarm'
import { MaitriFuelStation } from './MaitriFuelStation'
import { MaitriLakeWaterPumpHouse } from './MaitriLakeWaterPumpHouse'
import { MaitriSummerCamp } from './MaitriSummerCamp'
import { MaitriUtilityArea } from './MaitriUtilityArea'

function place(anchor: { x: number; z: number }) {
  const y = maitriTerrainHeight(anchor.x, anchor.z)
  return [anchor.x, y, anchor.z] as [number, number, number]
}

export function MaitriStation() {
  return (
    <group name="MaitriCampus">
      <group position={place(MAITRI_FACILITIES.mainBuilding)}>
        <MaitriMainBuilding />
      </group>
      <group position={place(MAITRI_FACILITIES.fuelFarm)}>
        <MaitriFuelFarm />
      </group>
      <group position={place(MAITRI_FACILITIES.fuelStation)}>
        <MaitriFuelStation />
      </group>
      <group position={place(MAITRI_FACILITIES.waterPumpHouse)}>
        <MaitriLakeWaterPumpHouse />
      </group>
      <group position={place(MAITRI_FACILITIES.summerCamp)}>
        <MaitriSummerCamp />
      </group>
      <group position={place(MAITRI_FACILITIES.utilityArea)}>
        <MaitriUtilityArea />
      </group>
    </group>
  )
}
