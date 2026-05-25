import { useEffect, useRef, useMemo } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useChannelStore } from '../store/channelStore'
import { generateSamples } from '../core/waveform'
import { computeFFT } from '../core/fft'
import { computeIdealSpectrum } from '../core/idealSpectrum'
import type { WindowType } from '../types/waveform'

const GRID_STROKE = 'rgba(255,255,255,0.05)'
const AXIS_STROKE = '#4A5568'
const TICK_STROKE = 'rgba(255,255,255,0.07)'

const WINDOW_OPTIONS: { value: WindowType; label: string }[] = [
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'hann', label: 'Hann' },
  { value: 'hamming', label: 'Hamming' },
  { value: 'blackman', label: 'Blackman' },
  { value: 'flattop', label: 'Flat Top' },
]

function fmtFreq(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  return `${v.toFixed(0)}`
}

export function Spectrum() {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)
  const { channels, globalConfig, spectrumConfig, updateSpectrumConfig } = useChannelStore()

  const enabledChannels = useMemo(() => channels.filter((ch) => ch.config.enabled), [channels])

  const plotData = useMemo((): uPlot.AlignedData => {
    const { sampleRate, recordLength } = globalConfig
    const { windowType } = spectrumConfig

    // Always compute the FFT frequency axis from a reference channel (or global config)
    const refSamples = enabledChannels.length > 0
      ? generateSamples(enabledChannels[0].config, sampleRate, recordLength)
      : new Float64Array(recordLength)
    const refFFT = computeFFT(refSamples, sampleRate, windowType)
    const freqAxis = refFFT.frequency

    const series: (Float64Array | number[])[] = [freqAxis]

    enabledChannels.forEach((ch) => {
      if (ch.mode === 'ideal') {
        series.push(computeIdealSpectrum(ch.config, freqAxis))
      } else {
        const s = generateSamples(ch.config, sampleRate, recordLength)
        const { magnitude } = computeFFT(s, sampleRate, windowType)
        series.push(magnitude)
      }
    })

    return series as uPlot.AlignedData
  }, [enabledChannels, globalConfig, spectrumConfig])

  const buildOpts = (width: number, height: number): uPlot.Options => ({
    width,
    height,
    padding: [12, 16, 0, 0],
    cursor: { points: { show: false } },
    legend: { show: false },
    scales: {
      x: { time: false, distr: spectrumConfig.logScale ? 3 : 1 },
      y: { auto: true },
    },
    axes: [
      {
        stroke: AXIS_STROKE,
        ticks: { stroke: TICK_STROKE, width: 1 },
        grid: { stroke: GRID_STROKE, width: 1 },
        font: '11px JetBrains Mono, monospace',
        values: (_u, vals) => vals.map((v) => (v != null ? fmtFreq(v) : '')),
        label: 'Frequency (Hz)',
        labelFont: '11px JetBrains Mono, monospace',
        labelSize: 16,
      },
      {
        stroke: AXIS_STROKE,
        ticks: { stroke: TICK_STROKE, width: 1 },
        grid: { stroke: GRID_STROKE, width: 1 },
        font: '11px JetBrains Mono, monospace',
        values: (_u, vals) => vals.map((v) => (v != null ? `${v.toFixed(0)}dB` : '')),
        size: 54,
        label: 'dBFS',
        labelFont: '11px JetBrains Mono, monospace',
        labelSize: 16,
      },
    ],
    series: [
      {},
      ...enabledChannels.map((ch) => ({
        stroke: ch.color,
        width: 1.5,
        dash: ch.mode === 'ideal' ? [6, 3] : undefined,
        fill: ch.mode === 'ideal' ? undefined : (u: uPlot) => {
          const ctx = u.ctx
          const grad = ctx.createLinearGradient(0, 0, 0, u.height)
          grad.addColorStop(0, ch.color + '30')
          grad.addColorStop(1, ch.color + '00')
          return grad
        },
      })),
    ],
  })

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    container.innerHTML = ''
    plotRef.current?.destroy()
    plotRef.current = null

    let plotInstance: uPlot | null = null

    const createOrResize = (w: number, h: number) => {
      if (w === 0 || h === 0) return
      if (!plotInstance) {
        const el = document.createElement('div')
        container.appendChild(el)
        plotInstance = new uPlot(buildOpts(w, h), plotData, el)
        plotRef.current = plotInstance
      } else {
        plotInstance.setSize({ width: w, height: h })
      }
    }

    const ro = new ResizeObserver((entries) => {
      const { width: w, height: h } = entries[0].contentRect
      createOrResize(w, h)
    })
    ro.observe(container)

    // Also try immediately in case layout is already known
    const rect = container.getBoundingClientRect()
    createOrResize(rect.width, rect.height)

    return () => {
      ro.disconnect()
      plotInstance?.destroy()
      plotRef.current = null
    }
  }, [enabledChannels.map((c) => `${c.id}:${c.mode}`).join(','), spectrumConfig.logScale])

  useEffect(() => {
    plotRef.current?.setData(plotData)
  }, [plotData])

  return (
    <div className="flex flex-col w-full h-full">
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: '#8892A4', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            FREQUENCY DOMAIN
          </span>
          <div className="flex items-center gap-2">
            {enabledChannels.map((ch) => (
              <span
                key={ch.id}
                style={{ color: ch.color, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
                className="flex items-center gap-1"
              >
                <span style={{ display: 'inline-block', width: 16, height: 2, background: ch.color, borderRadius: 1, marginRight: 2 }} />
                {ch.label}{ch.mode === 'ideal' && <span style={{ fontSize: 9, color: '#7EF7B8', marginLeft: 2 }}>✦</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Window function */}
          <div className="flex items-center gap-2">
            <span style={{ color: '#4A5568', fontSize: 11 }}>Window</span>
            <select
              value={spectrumConfig.windowType}
              onChange={(e) => updateSpectrumConfig({ windowType: e.target.value as WindowType })}
              style={{
                background: '#1C2132',
                color: '#8892A4',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Log scale toggle */}
          <button
            onClick={() => updateSpectrumConfig({ logScale: !spectrumConfig.logScale })}
            style={{
              background: spectrumConfig.logScale ? '#1C2132' : 'transparent',
              color: spectrumConfig.logScale ? '#7EB8F7' : '#4A5568',
              border: `1px solid ${spectrumConfig.logScale ? 'rgba(126,184,247,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            Log
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full"
        style={{ background: '#000', overflow: 'hidden' }}
      />
    </div>
  )
}
