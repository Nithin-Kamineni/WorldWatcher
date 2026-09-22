import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyRootFontScale } from './theme/uiScale.ts'

// Before the first render: the whole design system is sized in rem off this, so setting it
// after mount would paint one frame at full size and then reflow the entire app.
applyRootFontScale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
