import type { WaveformConfig } from '../types/waveform'

function gaussianRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function generateSamples(
  config: WaveformConfig,
  sampleRate: number,
  recordLength: number,
): Float64Array {
  const { type, frequency, amplitude, offset, phase, dutyCycle, noiseLevel } = config
  const samples = new Float64Array(recordLength)
  const phaseRad = (phase * Math.PI) / 180
  const dt = 1 / sampleRate
  const omega = 2 * Math.PI * frequency

  for (let i = 0; i < recordLength; i++) {
    const t = i * dt
    const arg = omega * t + phaseRad
    let v = 0

    switch (type) {
      case 'sine':
        v = Math.sin(arg)
        break
      case 'square': {
        const p = ((arg / (2 * Math.PI)) % 1 + 1) % 1
        v = p < dutyCycle / 100 ? 1 : -1
        break
      }
      case 'triangle': {
        const p = ((arg / (2 * Math.PI)) % 1 + 1) % 1
        v = p < 0.5 ? 4 * p - 1 : 3 - 4 * p
        break
      }
      case 'sawtooth': {
        const p = ((arg / (2 * Math.PI)) % 1 + 1) % 1
        v = 2 * p - 1
        break
      }
      case 'pulse': {
        const p = ((arg / (2 * Math.PI)) % 1 + 1) % 1
        v = p < dutyCycle / 100 ? 1 : -1
        break
      }
    }

    if (noiseLevel > 0) v += noiseLevel * gaussianRandom()
    samples[i] = v * amplitude + offset
  }

  return samples
}

export function generateTimeAxis(sampleRate: number, recordLength: number): Float64Array {
  const dt = 1 / sampleRate
  const t = new Float64Array(recordLength)
  for (let i = 0; i < recordLength; i++) t[i] = i * dt
  return t
}

/** Fixed point count used for the ideal high-resolution render */
export const IDEAL_RESOLUTION = 4096

/**
 * Generate a high-resolution, noise-free waveform for ideal mode.
 * Always uses IDEAL_RESOLUTION sample points over the same time window
 * as the realistic mode (duration = recordLength / sampleRate), so
 * both modes cover an identical time span.
 */
export function generateIdealSamples(
  config: WaveformConfig,
  sampleRate: number,
  recordLength: number,
): Float64Array {
  const duration = recordLength / sampleRate
  const idealSR = IDEAL_RESOLUTION / duration
  return generateSamples({ ...config, noiseLevel: 0 }, idealSR, IDEAL_RESOLUTION)
}

/**
 * Time axis for the ideal render — IDEAL_RESOLUTION evenly-spaced points
 * over the same duration as the realistic record window.
 */
export function generateIdealTimeAxis(sampleRate: number, recordLength: number): Float64Array {
  const duration = recordLength / sampleRate
  const dt = duration / (IDEAL_RESOLUTION - 1)
  const t = new Float64Array(IDEAL_RESOLUTION)
  for (let i = 0; i < IDEAL_RESOLUTION; i++) t[i] = i * dt
  return t
}
