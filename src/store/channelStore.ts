import { create } from 'zustand'
import type { Channel, GlobalConfig, SpectrumConfig, WaveformConfig } from '../types/waveform'

export const CHANNEL_COLORS = ['#7EB8F7', '#F7C97E', '#7EF7B8', '#C07EF7'] as const

const DEFAULT_CONFIG: WaveformConfig = {
  type: 'sine',
  frequency: 1000,
  amplitude: 1,
  offset: 0,
  phase: 0,
  dutyCycle: 50,
  noiseLevel: 0,
  enabled: true,
}

const makeChannel = (i: number): Channel => ({
  id: i + 1,
  label: `Ch ${i + 1}`,
  color: CHANNEL_COLORS[i],
  mode: 'realistic',
  config: {
    ...DEFAULT_CONFIG,
    enabled: i === 0,
    frequency: 1000,
    phase: i * 45,
  },
})

interface ChannelStore {
  channels: Channel[]
  globalConfig: GlobalConfig
  spectrumConfig: SpectrumConfig
  activeChannelId: number
  activePlotTab: 'oscilloscope' | 'spectrum'
  paramPanelOpen: boolean

  updateChannel: (id: number, patch: Partial<WaveformConfig>) => void
  setChannelMode: (id: number, mode: 'realistic' | 'ideal') => void
  setActiveChannel: (id: number) => void
  setActivePlotTab: (tab: 'oscilloscope' | 'spectrum') => void
  updateGlobalConfig: (patch: Partial<GlobalConfig>) => void
  updateSpectrumConfig: (patch: Partial<SpectrumConfig>) => void
  toggleParamPanel: () => void
}

export const useChannelStore = create<ChannelStore>((set) => ({
  channels: [0, 1, 2, 3].map(makeChannel),

  globalConfig: {
    sampleRate: 1_000_000,
    recordLength: 4096,
    timebase: 0.001,
    voltageScale: 1,
  },

  spectrumConfig: {
    windowType: 'hann',
    logScale: false,
  },

  activeChannelId: 1,
  activePlotTab: 'oscilloscope',
  paramPanelOpen: true,

  updateChannel: (id, patch) =>
    set((s) => ({
      channels: s.channels.map((ch) =>
        ch.id === id ? { ...ch, config: { ...ch.config, ...patch } } : ch,
      ),
    })),

  setChannelMode: (id, mode) =>
    set((s) => ({
      channels: s.channels.map((ch) => (ch.id === id ? { ...ch, mode } : ch)),
    })),

  setActiveChannel: (id) => set({ activeChannelId: id }),

  setActivePlotTab: (tab) => set({ activePlotTab: tab }),

  updateGlobalConfig: (patch) =>
    set((s) => ({ globalConfig: { ...s.globalConfig, ...patch } })),

  updateSpectrumConfig: (patch) =>
    set((s) => ({ spectrumConfig: { ...s.spectrumConfig, ...patch } })),

  toggleParamPanel: () => set((s) => ({ paramPanelOpen: !s.paramPanelOpen })),
}))
