import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'

// Política de privacidad pública (#/privacidad): la piden Google Play y las tiendas de los televisores.
// CONTACT: el correo donde se piden copias o el borrado de la cuenta. Debe ser el mismo de la ficha en la tienda.
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL as string | undefined
const UPDATED = '8 de noviembre de 2026'

export default function Privacidad() {
  const nav = useNavigate()
  return (
    <div className="screen" style={{ paddingBottom: 48 }}>
      <div className="pad">
        <button className="btn icon" aria-label="Volver" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} style={{ borderRadius: 24 }}>{Icon.back()}</button>
        <h1 className="h1" style={{ fontSize: 34, marginTop: 16 }}>Política de privacidad</h1>
        <p className="sub">Hoy Vemos · actualizada el {UPDATED}</p>
        <div className="legal">
          <p>Hoy Vemos recomienda películas y series para ver en pareja. Esta página explica qué datos usa, para qué y cómo borrarlos.</p>

          <h2>Sin cuenta</h2>
          <p>Si usas la app sin cuenta, tus gustos, Mi lista y la lista del día se guardan solo en tu dispositivo. No se envían a nuestros servidores.</p>

          <h2>Con cuenta</h2>
          <p>Si creas una cuenta guardamos tu correo, tu nombre y lo que haces en la app para que se sincronice con tu pareja y entre tus dispositivos: tus calificaciones (me gusta, no me interesa, ya la vi), Mi lista, tus notas privadas, tus plataformas y filtros, el hogar que compartes con tu pareja y, si activas los avisos, la suscripción de avisos de tu navegador. Estos datos se guardan en Supabase.</p>
          <p>Para conectar un televisor, guardamos por 10 minutos un código temporal y la cuenta que lo aprobó; después se borra.</p>

          <h2>Servicios que usamos</h2>
          <ul>
            <li><b>Supabase</b>: cuentas, base de datos y sincronización en vivo.</li>
            <li><b>Vercel</b>: aloja la app. Ve la dirección IP de cada pedido, que usamos solo para limitar el abuso.</li>
            <li><b>TMDB y OMDb</b>: la información de películas y series y sus notas. Les pedimos títulos, nunca tus datos.</li>
            <li><b>YouTube</b>: los tráilers se reproducen con el reproductor de YouTube en modo de privacidad mejorada.</li>
            <li><b>Anthropic</b>: si usas la búsqueda por estado de ánimo en Explorar, el texto que escribes se envía para entenderlo. No se asocia a tu cuenta.</li>
          </ul>

          <h2>Lo que no hacemos</h2>
          <p>No mostramos publicidad, no vendemos ni compartimos tus datos con terceros para publicidad y no usamos rastreadores de terceros.</p>

          <h2>Borrar tus datos</h2>
          <p>En Perfil puedes borrar tus calificaciones en cualquier momento. Para borrar tu cuenta y todos sus datos{CONTACT ? <>, escríbenos a <a href={`mailto:${CONTACT}`}>{CONTACT}</a> desde el correo de la cuenta</> : ', escríbenos al correo de contacto que aparece en la ficha de la app en la tienda'}; la borramos en un plazo de 30 días.</p>

          <h2>Menores</h2>
          <p>Hoy Vemos no está dirigida a menores de 13 años.</p>

          <h2>Cambios</h2>
          <p>Si esta política cambia, actualizamos esta página y la fecha de arriba.</p>
        </div>
      </div>
    </div>
  )
}
