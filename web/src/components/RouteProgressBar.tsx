import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Slim top progress bar that animates on every route change.
 * No dependencies — just CSS transitions + useLocation.
 */
export default function RouteProgressBar() {
  const location = useLocation()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setProgress(0)
    setVisible(true)
    const t1 = setTimeout(() => setProgress(65), 60)
    const t2 = setTimeout(() => setProgress(100), 350)
    const t3 = setTimeout(() => setVisible(false), 700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [location.pathname])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-0.5 pointer-events-none">
      <div
        className="h-full transition-all ease-out"
        style={{
          width: `${progress}%`,
          backgroundColor: '#FF6B00',
          transitionDuration: progress === 0 ? '0ms' : progress === 65 ? '200ms' : '300ms',
          boxShadow: '0 0 6px 1px rgba(255,107,0,0.5)',
        }}
      />
    </div>
  )
}
