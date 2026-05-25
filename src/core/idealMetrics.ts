import type { WaveformConfig, SignalMetrics, WaveformType } from '../types/waveform'

/** Theoretical amplitude of the nth harmonic for the given waveform */
function harmonicAmp(type: WaveformType, n: number, d: number, A: number): number {
  switch (type) {
    case 'sine':
      return n === 1 ? A : 0
    case 'square':
    case 'pulse':
      // H_n = (4A / nπ)|sin(nπd)|
      return (4 * A / (n * Math.PI)) * Math.abs(Math.sin(n * Math.PI * d))
    case 'triangle':
      // Only odd harmonics: H_n = 8A / (π²n²)
      return n % 2 === 0 ? 0 : 8 * A / (Math.PI * Math.PI * n * n)
    case 'sawtooth':
      // H_n = 2A / (nπ)
      return 2 * A / (n * Math.PI)
    default:
      return 0
  }
}

function idealTHD(
  type: WaveformType,
  d: number,
  A: number,
): { thd: number; harmonics: number[] } {
  const H1 = harmonicAmp(type, 1, d, A)
  const harmonics: number[] = []
  let harmonicSumSq = 0

  for (let h = 2; h <= 10; h++) {
    const Hn = harmonicAmp(type, h, d, A)
    harmonicSumSq += Hn * Hn
    harmonics.push(H1 > 1e-12 ? 20 * Math.log10(Hn / H1 + 1e-12) : -120)
  }

  const thd = H1 > 1e-12 ? (Math.sqrt(harmonicSumSq) / H1) * 100 : 0
  return { thd, harmonics }
}

/** Compute ideal (theoretical) metrics directly from waveform parameters */
export function computeIdealMetrics(config: WaveformConfig): SignalMetrics {
  const { type, frequency, amplitude: A, offset, dutyCycle } = config
  const d = dutyCycle / 100

  const vmax = A + offset
  const vmin = -A + offset
  const vpp = 2 * A
  const vpk = Math.max(Math.abs(vmax), Math.abs(vmin))
  const period = frequency > 0 ? 1 / frequency : 0

  let vrms: number
  let mean: number
  let dutyCycleOut: number
  let riseTime: number
  let fallTime: number

  switch (type) {
    case 'sine':
      // Vrms² = A²/2 + offset²
      vrms = Math.sqrt(A * A / 2 + offset * offset)
      mean = offset
      dutyCycleOut = 50
      // Rise time: 10%→90% of Vpp on a pure sine = 2·arcsin(0.8) / (2πf)
      riseTime = frequency > 0 ? (2 * Math.asin(0.8)) / (2 * Math.PI * frequency) : 0
      fallTime = riseTime
      break

    case 'square':
    case 'pulse':
      // Vrms² = A² + 2A·offset·(2d−1) + offset²
      vrms = Math.sqrt(A * A + 2 * A * offset * (2 * d - 1) + offset * offset)
      mean = A * (2 * d - 1) + offset
      dutyCycleOut = dutyCycle
      riseTime = 0
      fallTime = 0
      break

    case 'triangle':
      // Vrms² = A²/3 + offset²
      vrms = Math.sqrt(A * A / 3 + offset * offset)
      mean = offset
      dutyCycleOut = 50
      // 10%→90% of linear rise = 80% of half-period
      riseTime = frequency > 0 ? 0.4 / frequency : 0
      fallTime = riseTime
      break

    case 'sawtooth':
      vrms = Math.sqrt(A * A / 3 + offset * offset)
      mean = offset
      dutyCycleOut = 50
      // 10%→90% of linear rise = 80% of full period
      riseTime = frequency > 0 ? 0.8 / frequency : 0
      fallTime = 0
      break

    default:
      vrms = 0
      mean = offset
      dutyCycleOut = 50
      riseTime = 0
      fallTime = 0
  }

  const stdDev = Math.sqrt(Math.max(0, vrms * vrms - mean * mean))
  const crestFactor = vrms > 0 ? vpk / vrms : 0
  const { thd, harmonics } = idealTHD(type, d, A)

  return {
    vpp, vpk, vmin, vmax, vrms, mean, stdDev, crestFactor,
    frequency, period, dutyCycle: dutyCycleOut,
    riseTime, fallTime, overshoot: 0, undershoot: 0,
    thd, harmonics,
  }
}
