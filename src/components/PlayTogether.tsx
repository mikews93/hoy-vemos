import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { onPlatforms } from '../lib/platforms'
import { Icon } from './ui'
import type { Title } from '../data/types'

// "Darle play juntos": para cuando cada uno está en su casa. No controla Netflix ni ninguna plataforma
// (ninguna lo permite); arma una cuenta regresiva que llega al teléfono de la pareja por Supabase Realtime
// (broadcast: no guarda nada en la base), así los dos le dan play en el mismo segundo. El canal es privado:
// solo lo escucha y usa quien es del hogar (políticas en supabase/migrations/20261030000000_play_together.sql).

const SECONDS = 10 // tiempo para abrir la plataforma y dejar el título listo

interface Countdown {
  id: string
  title: string
  provider?: string
  from: string
  at: number // cuándo darle play, en la hora de este teléfono
  mine: boolean // la propuso quien usa este teléfono
}

// La cuenta regresiva en pantalla, compartida entre el botón de la ficha y el aviso que llega de la pareja
let current: Countdown | null = null
const listeners = new Set<() => void>()
const show = (c: Countdown | null) => {
  current = c
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

let channel: { hid: string; ch: RealtimeChannel } | null = null
function playChannel(hid: string): RealtimeChannel {
  if (channel?.hid === hid) return channel.ch
  if (channel) void supabase!.removeChannel(channel.ch)
  // Llega un segundo después de enviarlo como mucho: se descuenta el tiempo que ya pasó para que los dos terminen juntos
  const ch = supabase!
    .channel(`play-${hid}`, { config: { private: true } })
    .on('broadcast', { event: 'countdown' }, ({ payload }) => {
      const p = payload as Partial<Omit<Countdown, 'at' | 'mine'> & { sentAt: number; seconds: number }>
      if (typeof p.title !== 'string' || typeof p.from !== 'string') return
      const lag = Math.min(Math.max(Date.now() - Number(p.sentAt), 0), 1000) || 0
      const seconds = Math.min(Math.max(Number(p.seconds) || SECONDS, 3), 30)
      const text = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : undefined)
      show({ id: String(p.id), title: p.title.slice(0, 120), provider: text(p.provider, 40), from: p.from.slice(0, 40), at: Date.now() + seconds * 1000 - lag, mine: false })
    })
    .subscribe()
  channel = { hid, ch }
  return ch
}

/** Escucha las cuentas regresivas de la pareja en toda la app y las muestra encima de cualquier pantalla */
export function PlayTogetherHost() {
  const s = useStore()
  const hid = s.cloud && s.partnerJoined ? s.householdId : undefined
  useEffect(() => {
    if (hid) playChannel(hid)
  }, [hid])
  const c = useSyncExternalStore(subscribe, () => current)
  return c ? <CountdownOverlay c={c} /> : null
}

/** En la ficha: propone ver este título a la vez desde dos teléfonos */
export function PlayTogetherButton({ t }: { t: Title }) {
  const s = useStore()
  if (!s.cloud || !s.partnerJoined || !s.householdId) return null
  const hid = s.householdId
  const provider = t.providers.find((p) => p.kind === 'flatrate' && (s.settings.platforms.length === 0 || onPlatforms(p.name, s.settings.platforms)))?.name
  const start = () => {
    const payload = { id: t.id, title: t.title, provider, from: s.people.a.name, sentAt: Date.now(), seconds: SECONDS }
    void playChannel(hid).send({ type: 'broadcast', event: 'countdown', payload })
    show({ id: t.id, title: t.title, provider, from: s.people.a.name, at: Date.now() + SECONDS * 1000, mine: true })
  }
  return (
    <div className="pad" style={{ marginTop: 14 }}>
      <button className="btn block" style={{ height: 48 }} onClick={start}>
        {Icon.play(16)}Darle play juntos
      </button>
      <p className="note" style={{ marginTop: 6 }}>Para cuando están en casas distintas: una cuenta regresiva de {SECONDS} segundos llega a los dos teléfonos.</p>
    </div>
  )
}

function CountdownOverlay({ c }: { c: Countdown }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [])
  const left = Math.ceil((c.at - now) / 1000)
  // "¡Play!" queda unos segundos en pantalla y se cierra solo
  useEffect(() => {
    if (left > -4) return
    show(null)
  }, [left])
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Darle play juntos" aria-live="assertive">
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--coral)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
        {c.mine ? 'Le avisamos a tu pareja' : `${c.from} propone verla a la vez`}
      </span>
      <span style={{ fontFamily: 'var(--display)', fontSize: 30, fontWeight: 800, lineHeight: 1.05 }}>{c.title}</span>
      <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
        {left > 0 ? `Abran ${c.provider ?? 'la plataforma'}, dejen el título listo y denle play cuando llegue a cero.` : 'Ya, los dos al mismo tiempo.'}
      </span>
      <span style={{ fontFamily: 'var(--display)', fontSize: left > 0 ? 120 : 72, fontWeight: 800, lineHeight: 1, color: left > 0 ? 'var(--text)' : 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
        {left > 0 ? left : '¡Play!'}
      </span>
      <button className="btn block" style={{ maxWidth: 360, height: 52, background: 'transparent' }} onClick={() => show(null)}>Cerrar</button>
    </div>
  )
}
