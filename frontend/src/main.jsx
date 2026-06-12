import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#111111',
          color: '#dddddd',
          border: '1px solid #222222',
          fontFamily: "'Outfit', sans-serif",
          fontSize: '13px',
          borderRadius: '4px',
        },
        success: {
          iconTheme: { primary: '#e8b84b', secondary: '#080808' },
        },
        error: {
          iconTheme: { primary: '#cc4444', secondary: '#ffffff' },
        },
      }}
    />
  </StrictMode>,
)