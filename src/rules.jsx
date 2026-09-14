import React from 'react'
import { createRoot } from 'react-dom/client'
import RulesPage from './components/RulesPage.jsx'
import './styles.css'

// Entry for rules.html — the contest's official rules, generated from CONTEST in config.js so
// the prize and eligibility live in one place. No analytics, no service worker.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RulesPage />
  </React.StrictMode>
)
