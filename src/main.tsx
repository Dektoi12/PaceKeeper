import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { requestPersistentStorage, getSettings, migrateRemoveStrengthSessions } from './services/db'
import './index.css'

// Ask the browser to persist IndexedDB (best-effort, spec §4 storage safety).
void requestPersistentStorage()
// Seed the settings singleton once at startup so live reads never have to write.
void getSettings()
// Convert any legacy strength/mobility sessions (feature removed) to rest days.
void migrateRemoveStrengthSessions()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
