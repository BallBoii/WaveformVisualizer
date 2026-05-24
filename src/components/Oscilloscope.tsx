import { useEffect, useRef, useMemo, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useChannelStore } from '../store/channelStore'
import { generateSamples, generateTimeAxis } from '../core/waveform'

const GRID_STROKE = 'rgba(255,255,255,0.05)'
const AXIS_STROKE = '#4A5568'
const TICK_STROKE = 'rgba(255,255,255,0.07)'

function fmtTime(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) < 1e-6) return `${(v * 1e9).toFixed(0)}ns`
  if (Math.abs(v) < 1e-3) return `${(v * 1e6).toFixed(0)}µs`
  if (Math.abs(v) < 1) return `${(v * 1e3).toFixed(2)}ms`
  return `${v.toFixed(3)}s`
}
function fmtVolt(v: number): string { return `${v.toFixed(2)}V` }

const btnBase: React.CSSProperties = {
  background: 'transparent',
  color: '#8892A4',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 12,
  fontFamily: 'JetBrains Mono, monospace',
  cursor: 'pointer',
  lineHeight: 1.6,
  userSelect: 'none',
}

export function Oscilloscope() {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)
  const { channels, globalConfig } = useChannelStore()

  const enabledChannels = useMemo(() => channels.filter((ch) => ch.config.enabled), [channels])

  const plotData = useMemo((): uPlot.AlignedData => {
    const { sampleRate, recordLength } = globalConfig
    const time = generateTimeAxis(sampleRate, recordLength)
    const series: (Float64Array | number[])[] = [time]
    enabledChannels.forEach((ch) =>
      series.push(generateSamples(ch.config, sampleRate, recordLength))
    )
    return series as uPlot.AlignedData
  }, [enabledChannels, globalConfig])

  // Zoom & pan — refs for stable closure access, state only for rendering
  const [xZoom, setXZoomState] = useState(1)
  const xZoomRef = useRef(1)
  const xPanRef = useRef(0.5) // 0..1 centre position in full data range
  const plotDataRef = useRef(plotData)
  plotDataRef.current = plotData

  const setXZoom = (z: number) => { xZoomRef.current = z; setXZoomState(z) }

  const applyZoom = () => {
    const u = plotRef.current
    const data = plotDataRef.current
    if (!u || !data[0]) return
    const ta = data[0] as Float64Array
    if (!ta.length) return
    const fullMin = Number(ta[0])
    const fullMax = Number(ta[ta.length - 1])
    const zoom = xZoomRef.current
    const pan  = xPanRef.current
    if (zoom <= 1) {
      u.setScale('x', { min: fullMin, max: fullMax })
      return
    }
    const fullRange = fullMax - fullMin
    const viewHalf  = fullRange / (2 * zoom)
    const center    = fullMin + pan * fullRange
    u.setScale('x', {
      min: Math.max(fullMin, center - viewHalf),
      max: Math.min(fullMax, center + viewHalf),
    })
  }

  const zoomIn = () => { setXZoom(Math.min(xZoomRef.current * 2, 16)); applyZoom() }
  const zoomOut = () => { setXZoom(Math.max(xZoomRef.current / 2, 1)); applyZoom() }
  const panLeft = () => {
    if (xZoomRef.current <= 1) return
    const step = 0.3 / xZoomRef.current
    xPanRef.current = Math.max(0.5 / xZoomRef.current, xPanRef.current - step)
    applyZoom()
  }
  const panRight = () => {
    if (xZoomRef.current <= 1) return
    const step = 0.3 / xZoomRef.current
    xPanRef.current = Math.min(1 - 0.5 / xZoomRef.current, xPanRef.current + step)
    applyZoom()
  }
  const resetView = () => {
    xZoomRef.current = 1; xPanRef.current = 0.5
    setXZoomState(1); applyZoom()
  }

  const buildOpts = (width: number, height: number): uPlot.Options => ({
    width,
    height,
    padding: [12, 16, 0, 0],
    cursor: { points: { show: false } },
    legend: { show: false },
    scales: { x: { time: false }, y: { auto: true } },
    axes: [
      {
        stroke: AXIS_STROKE,
        ticks: { stroke: TICK_STROKE, width: 1 },
        grid: { stroke: GRID_STROKE, width: 1 },
        font: '11px JetBrains Mono, monospace',
        values: (_u, vals) => vals.map((v) => (v != null ? fmtTime(v) : '')),
      },
      {
        stroke: AXIS_STROKE,
        ticks: { stroke: TICK_STROKE, width: 1 },
        grid: { stroke: GRID_STROKE, width: 1 },
        font: '11px JetBrains Mono, monospace',
        values: (_u, vals) => vals.map((v) => (v != null ? fmtVolt(v) : '')),
        size: 54,
      },
    ],
    series: [
      {},
      ...enabledChannels.map((ch) => ({ stroke: ch.color, width: 1.5 })),
    ],
  })

  // Recreate plot when enabled channel set changes
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
        applyZoom()
      } else {
        plotInstance.setSize({ width: w, height: h })
      }
    }

    const ro = new ResizeObserver((entries) => {
      const { width: w, height: h } = entries[0].contentRect
      createOrResize(w, h)
    })
    ro.observe(container)
    // Try immediately — works if layout is already settled
    const r = container.getBoundingClientRect()
    createOrResize(r.width, r.height)

    return () => { ro.disconnect(); plotInstance?.destroy(); plotRef.current = null }
  }, [enabledChannels.map((c) => c.id).join(',')])

  // Push new data without rebuilding the plot
  useEffect(() => {
    plotRef.current?.setData(plotData)
    applyZoom()
  }, [plotData])

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* ── header bar ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* channel legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#8892A4', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            TIME DOMAIN
          </span>
          {enabledChannels.map((ch) => (
            <span key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 4, color: ch.color, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ display: 'inline-block', width: 14, height: 2, background: ch.color, borderRadius: 1 }} />
              {ch.label}
            </span>
          ))}
        </div>

        {/* zoom / pan controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {xZoom > 1 && (
            <span style={{ color: '#7EB8F7', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', marginRight: 4 }}>
              {xZoom}×
            </span>
          )}
          <button style={{ ...btnBase, opacity: xZoom <= 1 ? 0.35 : 1 }} onClick={panLeft}  title="Pan left">◀</button>
          <button style={btnBase}                                          onClick={zoomIn}  title="Zoom in">+</button>
          <button
            style={{ ...btnBase, color: xZoom > 1 ? '#7EB8F7' : '#8892A4', borderColor: xZoom > 1 ? 'rgba(126,184,247,0.4)' : 'rgba(255,255,255,0.1)' }}
            onClick={resetView} title="Reset zoom"
          >1:1</button>
          <button style={{ ...btnBase, opacity: xZoom <= 1 ? 0.35 : 1 }} onClick={zoomOut} title="Zoom out">−</button>
          <button style={{ ...btnBase, opacity: xZoom <= 1 ? 0.35 : 1 }} onClick={panRight} title="Pan right">▶</button>
          <span style={{ color: '#4A5568', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', marginLeft: 8 }}>
            {(globalConfig.sampleRate / 1e6).toFixed(1)} MHz · {globalConfig.recordLength} pts
          </span>
        </div>
      </div>

      {/* ── canvas area ── */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, width: '100%', background: '#000', overflow: 'hidden' }}
      />
    </div>
  )
}
