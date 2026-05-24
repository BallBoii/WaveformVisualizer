import type { SignalMetrics } from '../types/waveform'

export function computeMetrics(
  samples: Float64Array,
  sampleRate: number,
  fftMagnitude: Float64Array,
  fftFrequency: Float64Array,
): SignalMetrics {
  const N = samples.length

  // --- Amplitude & statistics ---
  let vmax = -Infinity, vmin = Infinity, sum = 0, sumSq = 0
  for (let i = 0; i < N; i++) {
    if (samples[i] > vmax) vmax = samples[i]
    if (samples[i] < vmin) vmin = samples[i]
    sum += samples[i]
    sumSq += samples[i] ** 2
  }
  const mean = sum / N
  const vrms = Math.sqrt(sumSq / N)
  const vpp = vmax - vmin
  const vpk = Math.max(Math.abs(vmax), Math.abs(vmin))
  const variance = sumSq / N - mean ** 2
  const stdDev = variance > 0 ? Math.sqrt(variance) : 0
  const crestFactor = vrms > 0 ? vpk / vrms : 0

  // --- Fundamental frequency from FFT peak (skip DC bin 0) ---
  let peakIdx = 1, peakMag = -Infinity
  for (let i = 1; i < fftMagnitude.length; i++) {
    if (fftMagnitude[i] > peakMag) {
      peakMag = fftMagnitude[i]
      peakIdx = i
    }
  }
  const frequency = fftFrequency[peakIdx] ?? 0
  const period = frequency > 0 ? 1 / frequency : 0

  // --- Duty cycle (fraction above midpoint) ---
  const mid = (vmax + vmin) / 2
  let aboveMid = 0
  for (let i = 0; i < N; i++) if (samples[i] > mid) aboveMid++
  const dutyCycle = (aboveMid / N) * 100

  // --- Rise / fall time (10 %→90 % of Vpp) ---
  const lo = vmin + 0.1 * vpp
  const hi = vmin + 0.9 * vpp
  let riseTime = 0, fallTime = 0

  for (let i = 1; i < N; i++) {
    if (samples[i - 1] <= lo && samples[i] > lo) {
      let j = i
      while (j < N && samples[j] < hi) j++
      if (j < N) { riseTime = (j - i) / sampleRate; break }
    }
  }
  for (let i = 1; i < N; i++) {
    if (samples[i - 1] >= hi && samples[i] < hi) {
      let j = i
      while (j < N && samples[j] > lo) j++
      if (j < N) { fallTime = (j - i) / sampleRate; break }
    }
  }

  // --- Overshoot / undershoot ---
  const topLevel = vmin + 0.9 * vpp
  const botLevel = vmin + 0.1 * vpp
  const overshoot = vpp > 0 ? Math.max(0, (vmax - topLevel) / vpp) * 100 : 0
  const undershoot = vpp > 0 ? Math.max(0, (botLevel - vmin) / vpp) * 100 : 0

  // --- THD (H2–H10 relative to fundamental) ---
  const binWidth = fftFrequency.length > 1 ? fftFrequency[1] - fftFrequency[0] : 1
  const fundamentalLinear = Math.pow(10, peakMag / 20)
  const harmonics: number[] = []
  let harmonicSumSq = 0

  for (let h = 2; h <= 10; h++) {
    const targetFreq = frequency * h
    const binIdx = Math.round(targetFreq / binWidth)
    if (binIdx > 0 && binIdx < fftMagnitude.length) {
      const dBc = fftMagnitude[binIdx] - peakMag
      harmonics.push(dBc)
      harmonicSumSq += Math.pow(10, fftMagnitude[binIdx] / 20) ** 2
    } else {
      harmonics.push(-120)
    }
  }
  const thd = fundamentalLinear > 0 ? (Math.sqrt(harmonicSumSq) / fundamentalLinear) * 100 : 0

  return {
    vpp, vpk, vmin, vmax, vrms, mean, stdDev, crestFactor,
    frequency, period, dutyCycle, riseTime, fallTime,
    overshoot, undershoot, thd, harmonics,
  }
}

export function fmt(value: number, unit: string, decimals = 3): string {
  if (!isFinite(value)) return '—'
  if (unit === 'Hz') {
    if (value >= 1e6) return `${(value / 1e6).toFixed(3)} MHz`
    if (value >= 1e3) return `${(value / 1e3).toFixed(3)} kHz`
    return `${value.toFixed(decimals)} Hz`
  }
  if (unit === 's') {
    if (value === 0) return '0 s'
    if (Math.abs(value) < 1e-6) return `${(value * 1e9).toFixed(2)} ns`
    if (Math.abs(value) < 1e-3) return `${(value * 1e6).toFixed(2)} µs`
    if (Math.abs(value) < 1) return `${(value * 1e3).toFixed(3)} ms`
    return `${value.toFixed(3)} s`
  }
  if (unit === 'V') return `${value.toFixed(decimals)} V`
  if (unit === '%') return `${value.toFixed(2)} %`
  if (unit === 'dBc') return `${value.toFixed(1)} dBc`
  return `${value.toFixed(decimals)} ${unit}`
}
