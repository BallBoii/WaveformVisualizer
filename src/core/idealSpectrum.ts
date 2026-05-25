import type { WaveformConfig, WaveformType } from '../types/waveform'

/** Theoretical harmonic amplitude for the nth harmonic */
function harmonicAmp(type: WaveformType, n: number, d: number, A: number): number {
  switch (type) {
    case 'sine':
      return n === 1 ? A : 0
    case 'square':
    case 'pulse':
      return (4 * A / (n * Math.PI)) * Math.abs(Math.sin(n * Math.PI * d))
    case 'triangle':
      return n % 2 === 0 ? 0 : 8 * A / (Math.PI * Math.PI * n * n)
    case 'sawtooth':
      return 2 * A / (n * Math.PI)
    default:
      return 0
  }
}

/**
 * Compute the ideal (analytical) spectrum on the same frequency axis as the FFT.
 * Returns a Float64Array of dB magnitudes, with -120 dB at non-harmonic bins
 * and the exact theoretical amplitude at harmonic bin positions.
 * The dB scaling matches computeFFT() output: 20·log10(amplitude).
 */
export function computeIdealSpectrum(
  config: WaveformConfig,
  freqAxis: Float64Array,
): Float64Array {
  const { type, frequency, amplitude: A, dutyCycle } = config
  const d = dutyCycle / 100
  const N = freqAxis.length
  const magnitude = new Float64Array(N).fill(-120)

  if (frequency <= 0 || A <= 0 || N < 2) return magnitude

  const binWidth = freqAxis[1] - freqAxis[0]
  if (binWidth <= 0) return magnitude

  const maxFreq = freqAxis[N - 1]
  const maxHarmonic = Math.min(200, Math.floor(maxFreq / frequency))

  for (let h = 1; h <= maxHarmonic; h++) {
    const hFreq = h * frequency
    const binIdx = Math.round(hFreq / binWidth)
    if (binIdx < 1 || binIdx >= N) continue

    const amp = harmonicAmp(type, h, d, A)
    if (amp > 1e-12) {
      // Use same scaling as computeFFT: 20·log10(amplitude)
      magnitude[binIdx] = 20 * Math.log10(amp)
    }
  }

  return magnitude
}
