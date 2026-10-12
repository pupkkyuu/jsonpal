import { lazy, Suspense } from 'react'

const EditorApp = lazy(() => import('./EditorApp'))

function App(): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {window.api.platform === 'win32' && (
        <header className="windows-titlebar">
          <div className="windows-titlebar-content app-drag-region">JSONPal</div>
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
