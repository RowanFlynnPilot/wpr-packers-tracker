import React from 'react'
import { createRoot } from 'react-dom/client'
import MiniStandings from './components/MiniStandings.jsx'
import { initAnalytics } from './analytics.js'
import './styles.css'

// Entry for mini-standings.html — the compact NFC North standings embed.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MiniStandings />
  </React.StrictMode>
)
