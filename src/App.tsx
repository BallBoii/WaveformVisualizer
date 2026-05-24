import { useChannelStore } from './store/channelStore'
import { TopBar } from './components/TopBar'
import { Oscilloscope } from './components/Oscilloscope'
import { Spectrum } from './components/Spectrum'
import { MetricsPanel } from './components/MetricsPanel'
import { ParameterPanel } from './components/ParameterPanel'

export default function App() {
  const activePlotTab = useChannelStore((s) => s.activePlotTab)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0B0E14',
        overflow: 'hidden',
      }}
    >
      <TopBar />

      {/* Plot area — fills all remaining space */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activePlotTab === 'oscilloscope' ? <Oscilloscope /> : <Spectrum />}
        </div>
        <MetricsPanel />
      </div>

      <ParameterPanel />
    </div>
  )
}
