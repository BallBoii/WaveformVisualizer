export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'pulse'

export type WindowType = 'rectangular' | 'hann' | 'hamming' | 'blackman' | 'flattop'

export type DisplayMode = 'sampled' | 'theoretical'

export interface WaveformConfig {
  type: WaveformType
  frequency: number   // Hz
  amplitude: number   // V (peak)
  offset: number      // V (DC)
  phase: number       // degrees
  dutyCycle: number   // 0–100 %
  noiseLevel: number  // 0–1
  enabled: boolean
}

export interface Channel {
  id: number
  label: string
  color: string
  config: WaveformConfig
}

export interface SignalMetrics {
  vpp: number
  vpk: number
  vmin: number
  vmax: number
  vrms: number
  mean: number
  stdDev: number
  crestFactor: number
  frequency: number
  period: number
  dutyCycle: number
  riseTime: number
  fallTime: number
  overshoot: number
  undershoot: number
  thd: number           // %
  harmonics: number[]   // dBc H2–H10
}

export interface GlobalConfig {
  sampleRate: number    // Hz
  recordLength: number  // samples (power of 2)
  timebase: number      // s/div
  voltageScale: number  // V/div
}

export interface SpectrumConfig {
  windowType: WindowType
  logScale: boolean
}
