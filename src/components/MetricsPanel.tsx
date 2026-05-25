import { useMemo } from 'react'
import { useChannelStore } from '../store/channelStore'
import { generateSamples } from '../core/waveform'
import { computeFFT } from '../core/fft'
import { computeMetrics, fmt } from '../core/metrics'
import { computeIdealMetrics } from '../core/idealMetrics'
import type { SignalMetrics } from '../types/waveform'

interface MetricCardProps {
  label: string
  value: string
  color: string
}

function MetricCard({ label, value, color }: MetricCardProps) {
  return (
    <div
      className="rounded flex flex-col px-3 py-2"
      style={{
        background: '#1C2132',
        borderLeft: `2px solid ${color}`,
        minWidth: 90,
      }}
    >
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          color: '#E0E6F0',
          fontWeight: 500,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      <span style={{ color: '#4A5568', fontSize: 10, marginTop: 2 }}>{label}</span>
    </div>
  )
}

interface MetricGroupProps {
  title: string
  channel: { id: number; label: string; color: string; mode: 'realistic' | 'ideal' }
  metrics: SignalMetrics
}

function MetricGroup({ title, channel, metrics: m }: MetricGroupProps) {
  const color = channel.color
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ color, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
          {channel.label}
        </span>
        <span style={{ color: '#4A5568', fontSize: 10 }}>{title}</span>
        <span style={{
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          color: channel.mode === 'ideal' ? '#7EF7B8' : '#4A5568',
          background: channel.mode === 'ideal' ? 'rgba(126,247,184,0.1)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${channel.mode === 'ideal' ? 'rgba(126,247,184,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 3,
          padding: '1px 5px',
        }}>
          {channel.mode === 'ideal' ? 'IDEAL' : 'REAL'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <MetricCard label="Vpp" value={fmt(m.vpp, 'V')} color={color} />
        <MetricCard label="Vrms" value={fmt(m.vrms, 'V')} color={color} />
        <MetricCard label="Vmax" value={fmt(m.vmax, 'V')} color={color} />
        <MetricCard label="Vmin" value={fmt(m.vmin, 'V')} color={color} />
        <MetricCard label="Mean" value={fmt(m.mean, 'V')} color={color} />
        <MetricCard label="Freq" value={fmt(m.frequency, 'Hz')} color={color} />
        <MetricCard label="Period" value={fmt(m.period, 's')} color={color} />
        <MetricCard label="Duty" value={fmt(m.dutyCycle, '%')} color={color} />
        <MetricCard label="Rise" value={fmt(m.riseTime, 's')} color={color} />
        <MetricCard label="Fall" value={fmt(m.fallTime, 's')} color={color} />
        <MetricCard label="THD" value={fmt(m.thd, '%')} color={color} />
        <MetricCard label="Crest" value={fmt(m.crestFactor, '', 2)} color={color} />
      </div>
    </div>
  )
}

export function MetricsPanel() {
  const { channels, globalConfig, spectrumConfig } = useChannelStore()
  const enabledChannels = channels.filter((ch) => ch.config.enabled)

  const allMetrics = useMemo(() => {
    const { sampleRate, recordLength } = globalConfig
    return enabledChannels.map((ch) => {
      if (ch.mode === 'ideal') {
        return { channel: ch, metrics: computeIdealMetrics(ch.config) }
      }
      const samples = generateSamples(ch.config, sampleRate, recordLength)
      const { magnitude, frequency } = computeFFT(samples, sampleRate, spectrumConfig.windowType)
      return { channel: ch, metrics: computeMetrics(samples, sampleRate, magnitude, frequency) }
    })
  }, [enabledChannels, globalConfig, spectrumConfig.windowType])

  if (!allMetrics.length) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 64, color: '#4A5568', fontSize: 12 }}
      >
        Enable at least one channel to see metrics
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto shrink-0"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 16px',
        background: '#131720',
      }}
    >
      <div className="flex gap-8">
        {allMetrics.map(({ channel, metrics }) => (
          <MetricGroup
            key={channel.id}
            title=""
            channel={channel}
            metrics={metrics}
          />
        ))}
      </div>
    </div>
  )
}
