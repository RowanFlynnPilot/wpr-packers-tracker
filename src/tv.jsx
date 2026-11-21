import React from 'react'
import { createRoot } from 'react-dom/client'
import TvBoard from './components/TvBoard.jsx'
import { initAnalytics } from './analytics.js'
import './styles.css'

// Entry for tv.html — the bar TV board. No service worker (a screen left on for days should
// always load the current build); analytics counts each time a venue opens the board.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TvBoard />
  </React.StrictMode>
)
