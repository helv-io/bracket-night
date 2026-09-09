import { Navigate, Route, Routes } from 'react-router-dom'
import { HostNight } from './tv/HostNight'
import { PlayerApp } from './player/PlayerApp'
import { StudioApp } from './studio/StudioApp'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HostNight />} />
      <Route path="/join" element={<PlayerApp />} />
      <Route path="/new" element={<StudioApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
