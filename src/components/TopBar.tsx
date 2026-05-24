import { useChannelStore } from '../store/channelStore'
import { generateSamples, generateTimeAxis } from '../core/waveform'

export function TopBar() {
  const { activePlotTab, setActivePlotTab, channels, globalConfig } = useChannelStore()

  const handleExport = () => {
    const enabled = channels.filter((ch) => ch.config.enabled)
    if (!enabled.length) return
    const { sampleRate: sr, recordLength: rl } = globalConfig
    const time = generateTimeAxis(sr, rl)
    const allSamples = enabled.map((ch) => generateSamples(ch.config, sr, rl))

    let csv = 'time_s'
    enabled.forEach((ch) => (csv += `,${ch.label}_V`))
    csv += '\n'
    for (let i = 0; i < rl; i++) {
      let row = time[i].toExponential(6)
      allSamples.forEach((s) => (row += `,${s[i].toFixed(6)}`))
      csv += row + '\n'
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'waveform.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0"
      style={{ height: 48, borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm tracking-wide" style={{ color: '#E0E6F0' }}>WV</span>
        <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
        <span style={{ color: '#8892A4', fontSize: 12 }}>AWG Waveform Visualizer</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded px-1 py-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {(['oscilloscope', 'spectrum'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActivePlotTab(tab)}
              className="rounded px-3 py-1 text-xs font-medium capitalize"
              style={{
                background: activePlotTab === tab ? '#1C2132' : 'transparent',
                color: activePlotTab === tab ? '#E0E6F0' : '#8892A4',
                border: activePlotTab === tab ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                transition: 'all 150ms ease',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          className="rounded px-3 py-1 text-xs font-medium"
          style={{ background: '#1C2132', color: '#8892A4', border: '1px solid rgba(255,255,255,0.1)', transition: 'color 150ms' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#E0E6F0')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8892A4')}
        >
          Export CSV
        </button>
      </div>
    </header>
  )
}
