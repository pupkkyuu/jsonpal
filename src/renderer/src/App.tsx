import { lazy, Suspense } from 'react'

const EditorApp = lazy(() => import('./EditorApp'))

function App(): React.JSX.Element {
  const useTitleBarOverlay = window.api.platform === 'win32' || window.api.platform === 'linux'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {useTitleBarOverlay && (
        <header className="desktop-titlebar">
          <div className="desktop-titlebar-content app-drag-region" />
        </header>
      )}
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="h-full bg-white" />}>
          <EditorApp />
        </Suspense>
      </div>
    </div>
  )
}

export default App
