import { useAuth } from '../lib/store'
import { Icon } from './ui'

const COUPLE = 'Para elegir juntos cada uno necesita su cuenta, así sus votos se cruzan aunque estén en teléfonos distintos.'

// Botones de crear cuenta / entrar para quien usa la app sin cuenta
export function AccountButtons({ reason }: { reason?: string }) {
  const { askLogin } = useAuth()
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button className="btn gold" style={{ flex: 1, height: 48 }} onClick={() => askLogin({ reason, mode: 'up' })}>Crear cuenta</button>
      <button className="btn" style={{ flex: 1, height: 48 }} onClick={() => askLogin({ reason, mode: 'in' })}>Ya tengo cuenta</button>
    </div>
  )
}

// Modo pareja sin cuenta: explica qué gana al crearla en vez de mostrar el mazo
export function NeedAccount() {
  return (
    <div className="screen">
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        <span style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--coral)', color: 'var(--coral-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.heart(26, 'var(--coral-ink)')}</span>
        <h1 className="h1" style={{ fontSize: 34 }}>Elegir juntos</h1>
        <p className="sub" style={{ margin: 0 }}>
          Cada uno desliza títulos en su teléfono y cuando a los dos les gusta el mismo, aparece la coincidencia al instante. {COUPLE}
        </p>
        <p className="sub" style={{ margin: 0 }}>Lo que ya marcaste sin cuenta (gustos, tu lista, plataformas) pasa a tu cuenta.</p>
        <AccountButtons reason="Para elegir juntos necesitas una cuenta." />
      </div>
    </div>
  )
}
