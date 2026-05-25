import type { Channel, ModulationType, WaveformType } from '../types/waveform'
import { generateSamples, IDEAL_RESOLUTION } from './waveform'

export interface SampledChannels {
  /** channel id → sample array at effectiveSR / length */
  samples: Map<number, Float64Array>
  /** effective sample rate used for all channels */
  sampleRate: number
  /** number of samples per channel */
  length: number
}

/**
 * Returns true if this channel has active cross-channel modulation
 * with an enabled source that has already been computed.
 */
export function isChannelModulated(ch: Channel, enabledChannels: Channel[]): boolean {
  return (
    ch.modulation.enabled &&
    ch.modulation.sourceChannelId !== ch.id &&
    enabledChannels.some((c) => c.id === ch.modulation.sourceChannelId)
  )
}

// --- Internal helpers --------------------------------------------------------

function gaussianRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function evalWaveform(type: WaveformType, arg: number, dutyCycle: number): number {
  switch (type) {
    case 'sine': return Math.sin(arg)
    case 'square':
    case 'pulse': {
      const p = ((arg / (2 * Math.PI)) % 1 + 1) % 1
      return p < dutyCycle / 100 ? 1 : -1
    }
    case 'triangle': {
      const p = ((arg / (2 * Math.PI)) % 1 + 1) % 1
      return p < 0.5 ? 4 * p - 1 : 3 - 4 * p
    }
    case 'sawtooth': {
      const p = ((arg / (2 * Math.PI)) % 1 + 1) % 1
      return 2 * p - 1
    }
    default: return 0
  }
}

/**
 * Topological sort with cycle detection.
 * Returns enabled channel IDs in dependency order (sources before carriers).
 * Cycles are broken by clearing the offending channel's dependency.
 */
function topoSort(channels: Channel[]): number[] {
  const ids = channels.map((c) => c.id)

  // Build dependency map: carrierId → sourceId (null = no valid modulation dep)
  const deps = new Map<number, number | null>()
  for (const ch of channels) {
    const src =
      ch.modulation.enabled && ch.modulation.sourceChannelId !== ch.id
        ? ch.modulation.sourceChannelId
        : null
    deps.set(ch.id, src !== null && ids.includes(src) ? src : null)
  }

  const visited = new Set<number>()
  const sorted: number[] = []
  const inStack = new Set<number>()

  function visit(id: number): void {
    if (visited.has(id)) return
    if (inStack.has(id)) {
      deps.set(id, null) // break cycle — channel generates without modulation
      return
    }
    inStack.add(id)
    const dep = deps.get(id) ?? null
    if (dep !== null) visit(dep)
    inStack.delete(id)
    visited.add(id)
    sorted.push(id)
  }

  for (const id of ids) visit(id)
  return sorted
}

function applyModulation(
  config: Channel['config'],
  isIdeal: boolean,
  modSamples: Float64Array,
  modAmplitude: number,
  modOffset: number,
  modType: ModulationType,
  depth: number,
  effectiveSR: number,
  length: number,
): Float64Array {
  const { type, frequency, amplitude, offset, phase, dutyCycle, noiseLevel } = config
  const phaseRad = (phase * Math.PI) / 180
  const omega = 2 * Math.PI * frequency
  const dt = 1 / effectiveSR
  const output = new Float64Array(length)
  const normDiv = Math.abs(modAmplitude) || 1

  // Normalize mod signal to [-1, 1] (AC component relative to its amplitude)
  const mn = (i: number): number =>
    Math.max(-1, Math.min(1, (modSamples[i] - modOffset) / normDiv))

  if (modType === 'FM') {
    // Frequency modulation: accumulate instantaneous phase
    let phi = phaseRad
    for (let i = 0; i < length; i++) {
      const instFreq = frequency + depth * mn(i)
      phi += 2 * Math.PI * instFreq * dt
      let v = amplitude * evalWaveform(type, phi, dutyCycle) + offset
      if (!isIdeal && noiseLevel > 0) v += noiseLevel * amplitude * gaussianRandom()
      output[i] = v
    }
    return output
  }

  for (let i = 0; i < length; i++) {
    const t = i * dt
    const m = mn(i)
    let v: number

    switch (modType) {
      case 'AM': {
        const arg = omega * t + phaseRad
        v = amplitude * (1 + depth * m) * evalWaveform(type, arg, dutyCycle) + offset
        break
      }
      case 'PM': {
        const depthRad = (depth * Math.PI) / 180
        const arg = omega * t + phaseRad + depthRad * m
        v = amplitude * evalWaveform(type, arg, dutyCycle) + offset
        break
      }
      case 'PWM': {
        const arg = omega * t + phaseRad
        // depth is ±duty-cycle percentage-point swing
        const instDuty = Math.max(0, Math.min(100, dutyCycle + depth * m))
        v = amplitude * evalWaveform(type, arg, instDuty) + offset
        break
      }
      default:
        v = amplitude * evalWaveform(type, omega * t + phaseRad, dutyCycle) + offset
    }

    if (!isIdeal && noiseLevel > 0) v += noiseLevel * amplitude * gaussianRandom()
    output[i] = v
  }

  return output
}

// --- Public API --------------------------------------------------------------

/**
 * Generate samples for ALL enabled channels, resolving cross-channel modulation.
 *
 * - Uses IDEAL_RESOLUTION when any channel is in ideal mode.
 * - Cycles in the modulation graph are broken (the cycle-starter generates unmodulated).
 * - Ideal channels are computed noise-free; realistic channels include noise.
 */
export function generateAllSamples(
  channels: Channel[],
  sampleRate: number,
  recordLength: number,
): SampledChannels {
  const enabled = channels.filter((c) => c.config.enabled)

  const hasIdeal = enabled.some((ch) => ch.mode === 'ideal')
  const duration = recordLength / sampleRate
  const length = hasIdeal ? IDEAL_RESOLUTION : recordLength
  const effectiveSR = hasIdeal ? IDEAL_RESOLUTION / duration : sampleRate

  const sortedIds = topoSort(enabled)
  const samplesMap = new Map<number, Float64Array>()

  for (const id of sortedIds) {
    const ch = enabled.find((c) => c.id === id)
    if (!ch) continue

    const isIdeal = ch.mode === 'ideal'
    const baseConfig = isIdeal ? { ...ch.config, noiseLevel: 0 } : ch.config
    const { modulation } = ch

    if (
      modulation.enabled &&
      modulation.sourceChannelId !== ch.id &&
      samplesMap.has(modulation.sourceChannelId)
    ) {
      const srcCh = enabled.find((c) => c.id === modulation.sourceChannelId)
      samplesMap.set(
        id,
        applyModulation(
          baseConfig,
          isIdeal,
          samplesMap.get(modulation.sourceChannelId)!,
          srcCh?.config.amplitude ?? 1,
          srcCh?.config.offset ?? 0,
          modulation.type,
          modulation.depth,
          effectiveSR,
          length,
        ),
      )
    } else {
      samplesMap.set(id, generateSamples(baseConfig, effectiveSR, length))
    }
  }

  return { samples: samplesMap, sampleRate: effectiveSR, length }
}
