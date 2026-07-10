import React from 'react'
import { createRoot } from 'react-dom/client'
import MiniGame from './components/MiniGame.jsx'
import { initAnalytics } from './analytics.js'
import './styles.css'

// Entry for mini.html — the compact sidebar/article scoreboard. No service-worker
// registration here (the main page owns that); analytics still counts mini impressions.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MiniGame />
  </React.StrictMode>
)
