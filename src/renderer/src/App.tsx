import { lazy, Suspense } from 'react'

const IS_SETTINGS_WINDOW = new URLSearchParams(window.location.search).has('settings')
const EditorApp = lazy(() => import('./EditorApp'))
const SettingsApp = lazy(() => import('./SettingsApp'))

function App(): JSX.Element {
  const Page = IS_SETTINGS_WINDOW ? SettingsApp : EditorApp

  return (
    <Suspense fallback={<div className="h-screen bg-white" />}>
      <Page />
    </Suspense>
  )
}

export default App
