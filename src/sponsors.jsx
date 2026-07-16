import React from 'react'
import { createRoot } from 'react-dom/client'
import SponsorsPage from './components/SponsorsPage.jsx'
import { initAnalytics } from './analytics.js'
import './styles.css'

// Entry for sponsors.html — the hosted media-kit page. No service worker here (the main page
// owns that); analytics counts media-kit visits and Sponsor Inquiry clicks.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SponsorsPage />
  </React.StrictMode>
)
