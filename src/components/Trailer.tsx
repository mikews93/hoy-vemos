import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui'

// Saca el id de YouTube de una URL tipo watch?v=, youtu.be/ o /embed/.
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/)
  return m ? m[1] : null
}

export function TrailerModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const id = youtubeId(url)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="trailer-backdrop" role="dialog" aria-modal="true" aria-label={`Tráiler de ${title}`} onClick={onClose}>
      <div className="trailer-box" onClick={(e) => e.stopPropagation()}>
        <div className="trailer-head">
          <span>Tráiler · {title}</span>
          <button className="btn icon" aria-label="Cerrar tráiler" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 20 }}>{Icon.x(20)}</button>
        </div>
        {id ? (
          <div className="trailer-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
              title={`Tráiler de ${title}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="sub" style={{ padding: 20 }}>No pudimos cargar este tráiler. <a href={url} target="_blank" rel="noreferrer">Abrirlo en YouTube</a></p>
        )}
      </div>
    </div>,
    document.body,
  )
}
