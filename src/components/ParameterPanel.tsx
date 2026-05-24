import { useState } from 'react'
import { useChannelStore } from '../store/channelStore'
import type { WaveformType } from '../types/waveform'

const WAVEFORM_TYPES: WaveformType[] = ['sine', 'square', 'triangle', 'sawtooth', 'pulse']

interface FieldProps {
  label: string
  children: React.ReactNode
}
function Field({ label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 80 }}>
      <span style={{ color: '#4A5568', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

const inputStyle = (color: string): React.CSSProperties => ({
  background: 'transparent',
  color: '#E0E6F0',
  border: 'none',
  borderBottom: `1px solid rgba(255,255,255,0.12)`,
  outline: 'none',
  fontSize: 13,
  fontFamily: 'JetBrains Mono, monospace',
  width: '100%',
  padding: '2px 0',
  transition: 'border-color 150ms',
  caretColor: color,
})

const selectStyle: React.CSSProperties = {
  background: '#1C2132',
  color: '#E0E6F0',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 12,
  fontFamily: 'JetBrains Mono, monospace',
  outline: 'none',
  cursor: 'pointer',
  width: '100%',
}

const unitSelectStyle: React.CSSProperties = {
  background: '#1C2132',
  color: '#8892A4',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
  cursor: 'pointer',
  padding: '2px 2px',
  flexShrink: 0,
}

const FREQ_UNITS = ['Hz', 'kHz', 'MHz'] as const
type FreqUnit = typeof FREQ_UNITS[number]
const FREQ_FACTORS: Record<FreqUnit, number> = { Hz: 1, kHz: 1e3, MHz: 1e6 }

const VOLT_UNITS = ['mV', 'V'] as const
type VoltUnit = typeof VOLT_UNITS[number]
const VOLT_FACTORS: Record<VoltUnit, number> = { mV: 1e-3, V: 1 }

function ChannelTab({ channelId }: { channelId: number }) {
  const { channels, updateChannel } = useChannelStore()
  const ch = channels.find((c) => c.id === channelId)!
  const cfg = ch.config
  const color = ch.color

  const [freqUnit, setFreqUnit] = useState<FreqUnit>('Hz')
  const [ampUnit, setAmpUnit]   = useState<VoltUnit>('V')
  const [offUnit, setOffUnit]   = useState<VoltUnit>('V')

  const update = (patch: Parameters<typeof updateChannel>[1]) => updateChannel(channelId, patch)

  return (
    <div className="flex flex-wrap items-end gap-5 px-4 py-3">
      {/* Enable toggle */}
      <Field label="Active">
        <button
          onClick={() => update({ enabled: !cfg.enabled })}
          style={{
            background: cfg.enabled ? color + '22' : 'transparent',
            color: cfg.enabled ? color : '#4A5568',
            border: `1px solid ${cfg.enabled ? color + '55' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 4,
            padding: '3px 12px',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            transition: 'all 150ms',
          }}
        >
          {cfg.enabled ? 'ON' : 'OFF'}
        </button>
      </Field>

      {/* Waveform type */}
      <Field label="Type">
        <select
          value={cfg.type}
          onChange={(e) => update({ type: e.target.value as WaveformType })}
          style={{ ...selectStyle, width: 110 }}
        >
          {WAVEFORM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </Field>

      {/* Frequency */}
      <Field label="Freq">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <input
            type="number"
            min={freqUnit === 'MHz' ? 0.000001 : freqUnit === 'kHz' ? 0.001 : 1}
            step={freqUnit === 'MHz' ? 0.001 : freqUnit === 'kHz' ? 0.1 : 100}
            value={+(cfg.frequency / FREQ_FACTORS[freqUnit]).toPrecision(6)}
            onChange={(e) => update({ frequency: Number(e.target.value) * FREQ_FACTORS[freqUnit] })}
            style={{ ...inputStyle(color), width: 72 }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = color)}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.12)')}
          />
          <select
            value={freqUnit}
            onChange={(e) => setFreqUnit(e.target.value as FreqUnit)}
            style={unitSelectStyle}
          >
            {FREQ_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </Field>

      {/* Amplitude */}
      <Field label="Amp">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <input
            type="number"
            min={ampUnit === 'mV' ? 1 : 0.001}
            step={ampUnit === 'mV' ? 10 : 0.1}
            value={+(cfg.amplitude / VOLT_FACTORS[ampUnit]).toPrecision(6)}
            onChange={(e) => update({ amplitude: Number(e.target.value) * VOLT_FACTORS[ampUnit] })}
            style={{ ...inputStyle(color), width: 60 }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = color)}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.12)')}
          />
          <select
            value={ampUnit}
            onChange={(e) => setAmpUnit(e.target.value as VoltUnit)}
            style={unitSelectStyle}
          >
            {VOLT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </Field>

      {/* DC Offset */}
      <Field label="Offset">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <input
            type="number"
            step={offUnit === 'mV' ? 10 : 0.1}
            value={+(cfg.offset / VOLT_FACTORS[offUnit]).toPrecision(6)}
            onChange={(e) => update({ offset: Number(e.target.value) * VOLT_FACTORS[offUnit] })}
            style={{ ...inputStyle(color), width: 60 }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = color)}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.12)')}
          />
          <select
            value={offUnit}
            onChange={(e) => setOffUnit(e.target.value as VoltUnit)}
            style={unitSelectStyle}
          >
            {VOLT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </Field>

      {/* Phase */}
      <Field label="Phase (°)">
        <input
          type="number"
          min={-360}
          max={360}
          step={1}
          value={cfg.phase}
          onChange={(e) => update({ phase: Number(e.target.value) })}
          style={{ ...inputStyle(color), width: 64 }}
          onFocus={(e) => (e.currentTarget.style.borderBottomColor = color)}
          onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.12)')}
        />
      </Field>

      {/* Duty cycle */}
      <Field label="Duty (%)">
          <input
            type="number"
            min={1}
            max={99}
            step={1}
            value={cfg.dutyCycle}
            onChange={(e) => update({ dutyCycle: Number(e.target.value) })}
            style={{ ...inputStyle(color), width: 56 }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = color)}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.12)')}
          />
        </Field>

      {/* Noise */}
      <Field label={`Noise ${(cfg.noiseLevel * 100).toFixed(0)}%`}>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.01}
          value={cfg.noiseLevel}
          onChange={(e) => update({ noiseLevel: Number(e.target.value) })}
          style={{ '--thumb-color': color } as React.CSSProperties}
        />
      </Field>
    </div>
  )
}

function DisplayTab() {
  const { globalConfig, updateGlobalConfig } = useChannelStore()
  const cfg = globalConfig

  return (
    <div className="flex flex-wrap items-end gap-5 px-4 py-3">
      <Field label="Sample Rate">
        <select
          value={cfg.sampleRate}
          onChange={(e) => updateGlobalConfig({ sampleRate: Number(e.target.value) })}
          style={{ ...selectStyle, width: 120 }}
        >
          {[100_000, 500_000, 1_000_000, 5_000_000, 10_000_000].map((r) => (
            <option key={r} value={r}>
              {r >= 1e6 ? `${r / 1e6} MHz` : `${r / 1e3} kHz`}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Record Length">
        <select
          value={cfg.recordLength}
          onChange={(e) => updateGlobalConfig({ recordLength: Number(e.target.value) })}
          style={{ ...selectStyle, width: 100 }}
        >
          {[512, 1024, 2048, 4096, 8192].map((n) => (
            <option key={n} value={n}>{n} pts</option>
          ))}
        </select>
      </Field>
    </div>
  )
}

export function ParameterPanel() {
  const { channels, activeChannelId, setActiveChannel, paramPanelOpen, toggleParamPanel } =
    useChannelStore()

  const tabs = [
    ...channels.map((ch) => ({ id: `ch-${ch.id}`, label: ch.label, color: ch.color })),
    { id: 'display', label: 'Display', color: '#8892A4' },
  ]

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: '#131720',
        flexShrink: 0,
        transition: 'height 200ms ease',
      }}
    >
      {/* Tab bar */}
      <div
        className="flex items-center gap-0"
        style={{ borderBottom: paramPanelOpen ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
      >
        {tabs.map((tab) => {
          const chId = tab.id.startsWith('ch-') ? parseInt(tab.id.replace('ch-', '')) : -1
          const isActive = tab.id === 'display'
            ? activeChannelId === -1
            : activeChannelId === chId
          const ch = channels.find((c) => c.id === chId)
          const isEnabled = ch?.config.enabled ?? true

          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveChannel(chId)
                if (!paramPanelOpen) toggleParamPanel()
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs"
              style={{
                background: isActive ? '#1C2132' : 'transparent',
                color: isActive ? '#E0E6F0' : '#4A5568',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                borderBottom: isActive ? '2px solid ' + tab.color : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 150ms',
                outline: 'none',
              }}
            >
              {chId > 0 && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isEnabled ? tab.color : '#4A5568',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
              )}
              {tab.label}
            </button>
          )
        })}

        {/* Collapse chevron */}
        <button
          onClick={toggleParamPanel}
          className="ml-auto px-3 py-2"
          style={{ color: '#4A5568', cursor: 'pointer', fontSize: 14, transition: 'color 150ms' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#8892A4')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#4A5568')}
          title={paramPanelOpen ? 'Collapse' : 'Expand'}
        >
          {paramPanelOpen ? '▼' : '▲'}
        </button>
      </div>

      {/* Panel body */}
      {paramPanelOpen && (
        <>
          {activeChannelId >= 1 && activeChannelId <= 4 ? (
            <ChannelTab channelId={activeChannelId} />
          ) : (
            <DisplayTab />
          )}
        </>
      )}
    </div>
  )
}
