import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { StoreProvider, useAuth, useStore } from './lib/store'
import { hasCloud, pendingInvite } from './lib/supabase'
import { TabBar } from './components/ui'
import Hoy from './screens/Hoy'
import Pareja from './screens/Pareja'
import Ficha from './screens/Ficha'
import Explorar from './screens/Explorar'
import Lista from './screens/Lista'
import Perfil from './screens/Perfil'
import Onboarding from './screens/Onboarding'
import Login from './screens/Login'
import './styles.css'

// Enlace de invitación #/unirse/CODIGO: se guarda el código y se usa al entrar
const invite = /^#\/unirse\/([A-Za-z0-9]+)/.exec(location.hash)
if (invite && hasCloud) {
  pendingInvite.set(invite[1])
  location.hash = '#/'
}

function Gate() {
  const { session, ready } = useAuth()
  if (!ready) return <div className="empty" style={{ marginTop: 80 }}>Abriendo…</div>
  if (hasCloud && !session) return <div className="app"><Login /></div>
  return <App />
}

function App() {
  const s = useStore()
  const loc = useLocation()
  if (s.loading && s.cloud) return <div className="empty" style={{ marginTop: 80 }}>Trayendo lo mejor de hoy…</div>
  if (!s.onboarded && loc.pathname !== '/bienvenida') return <Navigate to="/bienvenida" replace />
  const showTabs = s.onboarded && !loc.pathname.startsWith('/titulo') && loc.pathname !== '/bienvenida'
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Hoy />} />
        <Route path="/pareja" element={<Pareja />} />
        <Route path="/titulo/:id" element={<Ficha />} />
        <Route path="/explorar" element={<Explorar />} />
        <Route path="/lista" element={<Lista />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/bienvenida" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showTabs && <TabBar />}
    </div>
  )
}

// La vista previa embebida no permite rutas en el hash: ahí se navega en memoria
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : HashRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <Router>
        <Gate />
      </Router>
    </StoreProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_PREVIEW) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
