// Shared physically-plausible material presets.
// Each usage instantiates its own material so hover highlighting of one
// structure never bleeds into another.

type Override = Partial<{
  color: string
  roughness: number
  metalness: number
  flatShading: boolean
  transmission: number
}>

export const PanelWhite = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#e8eaec'} roughness={o.roughness ?? 0.55} metalness={o.metalness ?? 0.08} />
)

export const PanelLightGray = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#c9ced3'} roughness={o.roughness ?? 0.6} metalness={o.metalness ?? 0.15} />
)

export const PanelDarkTrim = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#2e343b'} roughness={o.roughness ?? 0.5} metalness={o.metalness ?? 0.25} />
)

export const AccentOrange = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#c8571d'} roughness={o.roughness ?? 0.5} metalness={o.metalness ?? 0.2} />
)

export const SteelGalvanized = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#8f979e'} roughness={o.roughness ?? 0.45} metalness={o.metalness ?? 0.65} />
)

export const SteelDark = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#4c545b'} roughness={o.roughness ?? 0.5} metalness={o.metalness ?? 0.6} />
)

export const GlassDark = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#1a242f'} roughness={o.roughness ?? 0.18} metalness={o.metalness ?? 0.4} />
)

/** Dark reflective transmissive glazing — tier-2 panoramic lounge ribbon. */
export const GlassPanoramic = (o: Override = {}) => (
  <meshPhysicalMaterial
    color={o.color ?? '#1a242f'}
    roughness={o.roughness ?? 0.08}
    metalness={o.metalness ?? 0.06}
    transmission={o.transmission ?? 0.72}
    thickness={0.5}
    ior={1.5}
  />
)

export const Concrete = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#9aa0a3'} roughness={o.roughness ?? 0.92} metalness={o.metalness ?? 0.02} />
)

export const SnowMat = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#f2f6fa'} roughness={o.roughness ?? 0.97} metalness={0} />
)

export const CompactedSnowMat = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#b9c4cf'} roughness={o.roughness ?? 0.98} metalness={0} />
)

export const RockMat = (o: Override = {}) => (
  <meshStandardMaterial
    color={o.color ?? '#6f6a63'}
    roughness={o.roughness ?? 1}
    metalness={0}
    flatShading={true}
  />
)

export const IceMat = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#cfe2f0'} roughness={o.roughness ?? 0.28} metalness={o.metalness ?? 0} />
)

export const TankWhite = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#e9ecee'} roughness={o.roughness ?? 0.42} metalness={o.metalness ?? 0.3} />
)

export const PipeInsul = (o: Override = {}) => (
  <meshStandardMaterial color={o.color ?? '#dfe3e6'} roughness={o.roughness ?? 0.5} metalness={o.metalness ?? 0.2} />
)

/** Coated architectural aluminum — faceted aerodynamic hull skin (refit). */
export const AluminumArchitectural = (o: Override = {}) => (
  <meshStandardMaterial
    color={o.color ?? '#cfd6dd'}
    roughness={o.roughness ?? 0.25}
    metalness={o.metalness ?? 0.6}
    flatShading={o.flatShading ?? true}
  />
)

/** Dark Larsemann-Hills gneiss — exposed bedrock ridges (refit). */
export const GneissRock = (o: Override = {}) => (
  <meshStandardMaterial
    color={o.color ?? '#46413b'}
    roughness={o.roughness ?? 0.98}
    metalness={0}
    flatShading={o.flatShading ?? true}
  />
)
