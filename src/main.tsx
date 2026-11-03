import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { ChromaticApp } from './designs/Prototype'
import './designs/designs.css'

const AuditPage = lazy(() => import('./pages/AuditPage').then(m => ({ default: m.AuditPage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const MethodologyPage = lazy(() => import('./pages/MethodologyPage').then(m => ({ default: m.MethodologyPage })))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<p role="status" style={{ padding: 24 }}>Loading…</p>}>
        <Routes>
          <Route path="/" element={<ChromaticApp />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          {/* Retired prototype/bookmark URLs return to the sole campus interface. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
