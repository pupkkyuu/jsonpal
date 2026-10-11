import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorSettings } from '@/editorSettings'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

const SAVE_DELAY_MS = 300

// Keep this hook in the workspace so navigating away from settings does not
// cancel a pending save. Save responses must never replace newer local edits.
export function useAutoSaveSettings() {
  const [saveError, setSaveError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<EditorSettings | null>(null)
  const saving = useRef(false)
  const mounted = useRef(true)

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
      pending.current = useWorkspaceStore.getState().settings
    }
    if (saving.current) return

    saving.current = true
    try {
      while (pending.current) {
        const snapshot = pending.current
        pending.current = null
        try {
          await window.api.settings.apply(snapshot)
          if (mounted.current) setSaveError('')
        } catch {
          if (mounted.current) setSaveError('配置保存失败，请重新修改后重试')
        }
      }
    } finally {
      saving.current = false
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<EditorSettings>) => {
    useWorkspaceStore.getState().updateSettings(patch)
    setSaveError('')
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, SAVE_DELAY_MS)
  }, [flush])

  useEffect(() => {
    mounted.current = true
    const onBeforeUnload = () => { void flush() }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      mounted.current = false
      window.removeEventListener('beforeunload', onBeforeUnload)
      void flush()
    }
  }, [flush])

  return { updateSettings, saveError }
}
