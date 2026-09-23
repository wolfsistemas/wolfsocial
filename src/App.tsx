import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { SessionProvider, useSession } from './lib/session'
import Login from './pages/Login'
import Setup from './pages/Setup'

const Accounts = lazy(() => import('./pages/Accounts'))
const Ads = lazy(() => import('./pages/Ads'))
const Bio = lazy(() => import('./pages/Bio'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Composer = lazy(() => import('./pages/Composer'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DataDeletion = lazy(() => import('./pages/DataDeletion'))
const Insights = lazy(() => import('./pages/Insights'))
const Join = lazy(() => import('./pages/Join'))
const Links = lazy(() => import('./pages/Links'))
const Media = lazy(() => import('./pages/Media'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Queue = lazy(() => import('./pages/Queue'))
const Settings = lazy(() => import('./pages/Settings'))
const Team = lazy(() => import('./pages/Team'))
const Terms = lazy(() => import('./pages/Terms'))

function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Carregando...
    </div>
  )
}

function Protected() {
  const { configured, loading, session } = useSession()
  if (!configured) return <Setup />
  if (loading) return <Loading />
  if (!session) return <Login />
  return <Outlet />
}

export default function App() {
  return (
    <SessionProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/bio/:slug" element={<Bio />} />
          <Route path="/join" element={<Join />} />

          <Route element={<Protected />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="media" element={<Media />} />
              <Route path="composer" element={<Composer />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="queue" element={<Queue />} />
              <Route path="insights" element={<Insights />} />
              <Route path="links" element={<Links />} />
              <Route path="team" element={<Team />} />
              <Route path="ads" element={<Ads />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SessionProvider>
  )
}
