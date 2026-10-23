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
import Invitados from './screens/Invitados'
import Resumen from './screens/Resumen'
import { NeedAccount } from './components/Account'
import './styles.css'

// Enlace de invitación #/unirse/CODIGO: se guarda el código y se usa al entrar
const invite = /^#\/unirse\/([A-Za-z0-9]+)/.exec(location.hash)
if (invite && hasCloud) {
  pendingInvite.set(invite[1])
  location.hash = '#/'
}

// La app se usa sin cuenta; la pantalla de entrar se abre encima solo cuando algo la necesita
function Gate() {
  const { ready, ask, closeLogin } = useAuth()
  if (!ready) return <div className="empty" style={{ marginTop: 80 }}>Abriendo…</div>
  return (
    <>
      <App />
      {ask && (
        <div className="login-sheet" role="dialog" aria-modal="true" aria-label="Entrar a Hoy Vemos">
          <div className="app"><Login reason={ask.reason} initialMode={ask.mode} onClose={closeLogin} /></div>
        </div>
      )}
    </>
  )
}

function App() {
  const s = useStore()
  const loc = useLocation()
  if (s.loading && s.cloud) return <div className="empty" style={{ marginTop: 80 }}>Trayendo lo mejor de hoy…</div>
  if (!s.onboarded && loc.pathname !== '/bienvenida') return <Navigate to="/bienvenida" replace />
  const showTabs = s.onboarded && !loc.pathname.startsWith('/titulo') && loc.pathname !== '/bienvenida' && loc.pathname !== '/invitados' && loc.pathname !== '/resumen'
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Hoy />} />
        <Route path="/pareja" element={s.guest ? <NeedAccount /> : <Pareja />} />
        <Route path="/titulo/:id" element={<Ficha />} />
        <Route path="/explorar" element={<Explorar />} />
        <Route path="/lista" element={<Lista />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/bienvenida" element={<Onboarding />} />
        <Route path="/invitados" element={<Invitados />} />
        <Route path="/resumen" element={<Resumen />} />
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
