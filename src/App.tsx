import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { SessionProvider, useSession } from './lib/session'
import Accounts from './pages/Accounts'
import Ads from './pages/Ads'
import Composer from './pages/Composer'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Media from './pages/Media'
import Queue from './pages/Queue'
import Settings from './pages/Settings'
import Setup from './pages/Setup'

function Shell() {
  const { configured, loading, session } = useSession()

  if (!configured) return <Setup />
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Carregando...
      </div>
    )
  }
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="media" element={<Media />} />
        <Route path="composer" element={<Composer />} />
        <Route path="queue" element={<Queue />} />
        <Route path="ads" element={<Ads />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  )
}
