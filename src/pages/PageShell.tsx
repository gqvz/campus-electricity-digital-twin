import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { chromatic } from '../designs/theme'
import { CubeMark } from '../designs/Prototype'

const p = chromatic.palette
export const themeVars = {
  '--p-bg': p.bg, '--p-surface': p.surface, '--p-ink': p.ink, '--p-muted': p.muted, '--p-border': p.border,
  '--p-accent': p.accent, '--p-on-accent': p.onAccent, '--p-scene': p.scene, '--p-high': p.high, '--p-medium': p.medium,
  '--p-radius': `${chromatic.radius}px`, '--p-display': `'${chromatic.display}', sans-serif`, '--p-body': `'${chromatic.body}', sans-serif`,
  '--p-mono': `'${chromatic.mono}', monospace`,
} as CSSProperties

export function PageShell({ title, lead, children, actions }: { title: string; lead?: string; children: ReactNode; actions?: ReactNode }) {
  return <div className="prototype direction-chromatic page-shell" style={themeVars}>
    <header className="prototype-header">
      <Link className="prototype-brand" to="/" aria-label="IITR Pulse home"><CubeMark /><div><b>IITR Pulse<span className="brand-stop">.</span></b><span>Campus electricity audit</span></div></Link>
      <div className="prototype-header-right">{actions}<Link className="header-link" to="/"><ArrowLeft size={14} aria-hidden="true" /> Campus</Link></div>
    </header>
    <main className="page" id="main">
      <h1>{title}</h1>
      {lead && <p className="page-lead">{lead}</p>}
      {children}
    </main>
    <footer className="prototype-footnote"><span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> / Independent student project, not an official IITR platform</span></footer>
  </div>
}
