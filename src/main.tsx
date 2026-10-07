import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChromaticApp } from './designs/Prototype'
import './designs/designs.css'

// Retired prototype/bookmark URLs no longer expose alternative designs.
if (window.location.pathname !== '/' || window.location.search) {
  window.history.replaceState(null, '', '/')
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ChromaticApp /></React.StrictMode>)
