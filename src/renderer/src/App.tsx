import { lazy, Suspense } from 'react'

const EditorApp = lazy(() => import('./EditorApp'))

function App(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="h-screen bg-white" />}>
      <EditorApp />
    </Suspense>
  )
}

export default App
