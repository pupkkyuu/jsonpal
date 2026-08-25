import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createTabId,
  getErrorMessage,
  getJsonErrorLocation,
  getValidationFeedback,
  INITIAL_TAB,
  type JsonTab,
  type TabFeedback
} from '@/jsonUtils'

interface UseJsonTabsResult {
  tabs: JsonTab[]
  activeTab: JsonTab
  activeFeedback: TabFeedback
  markerErrorLines: number[]
  setTabs: (tabs: JsonTab[]) => void
  setActiveTabId: (id: string) => void
  setTabFeedback: (tabId: string, feedback: TabFeedback) => void
  setMarkerErrorLines: (tabId: string, lines: number[]) => void
  updateValue: (nextValue: string, feedback?: TabFeedback) => void
  showJsonError: (tabId: string, value: string, error: unknown) => void
  addTab: () => void
  renameTab: (tabId: string, title: string) => void
  closeTab: (tabId: string) => void
}

export function useJsonTabs(onTabClosed?: (tabId: string) => void): UseJsonTabsResult {
  const [tabs, setTabs] = useState<JsonTab[]>([INITIAL_TAB])
  const [activeTabId, setActiveTabId] = useState(INITIAL_TAB.id)
  const [feedbackByTab, setFeedbackByTab] = useState<Record<string, TabFeedback>>({
    [INITIAL_TAB.id]: getValidationFeedback(INITIAL_TAB.value)
  })
  const [markerErrorLinesByTab, setMarkerErrorLinesByTab] = useState<Record<string, number[]>>({})
  const untitledCounterRef = useRef(2)
  const validationTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => () => Object.values(validationTimersRef.current).forEach(clearTimeout), [])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!
  const activeFeedback = feedbackByTab[activeTab.id] ?? getValidationFeedback(activeTab.value)
  const markerErrorLines = markerErrorLinesByTab[activeTab.id] ?? []

  const setTabFeedback = useCallback((tabId: string, feedback: TabFeedback) => {
    setFeedbackByTab((current) => ({ ...current, [tabId]: feedback }))
  }, [])

  const setMarkerErrorLines = useCallback((tabId: string, lines: number[]) => {
    setMarkerErrorLinesByTab((current) => {
      const previous = current[tabId] ?? []
      if (previous.length === lines.length && previous.every((line, index) => line === lines[index])) return current
      return { ...current, [tabId]: lines }
    })
  }, [])

  const updateValue = useCallback(
    (nextValue: string, feedback?: TabFeedback) => {
      const tabId = activeTab.id
      setTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, value: nextValue } : tab)))
      if (validationTimersRef.current[tabId]) clearTimeout(validationTimersRef.current[tabId])
      if (feedback) {
        setTabFeedback(tabId, feedback)
      } else {
        setTabFeedback(tabId, { message: '正在校验 JSON...', isValid: true, parseErrorLine: null })
        validationTimersRef.current[tabId] = setTimeout(() => {
          setTabFeedback(tabId, getValidationFeedback(nextValue))
          delete validationTimersRef.current[tabId]
        }, 180)
      }
    },
    [activeTab.id, setTabFeedback]
  )

  const showJsonError = useCallback(
    (tabId: string, value: string, error: unknown) => {
      setTabFeedback(tabId, {
        isValid: false,
        parseErrorLine: getJsonErrorLocation(value, error)?.line ?? 1,
        message: getErrorMessage(value, error)
      })
    },
    [setTabFeedback]
  )

  const addTab = useCallback(() => {
    const tab: JsonTab = { id: createTabId(), title: `未命名 ${untitledCounterRef.current++}`, value: '' }
    setTabs((current) => [...current, tab])
    setTabFeedback(tab.id, getValidationFeedback(tab.value))
    setActiveTabId(tab.id)
  }, [setTabFeedback])

  const renameTab = useCallback((tabId: string, title: string) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)))
  }, [])

  const closeTab = useCallback(
    (tabId: string) => {
      const closingIndex = tabs.findIndex((tab) => tab.id === tabId)
      if (closingIndex === -1) return

      let nextTabs = tabs.filter((tab) => tab.id !== tabId)
      if (nextTabs.length === 0) {
        nextTabs = [{ id: createTabId(), title: `未命名 ${untitledCounterRef.current++}`, value: '' }]
      }

      setTabs(nextTabs)
      setFeedbackByTab((current) => {
        const nextFeedback = { ...current }
        delete nextFeedback[tabId]
        if (!nextFeedback[nextTabs[0].id]) nextFeedback[nextTabs[0].id] = getValidationFeedback(nextTabs[0].value)
        return nextFeedback
      })
      setMarkerErrorLinesByTab((current) => {
        const nextLines = { ...current }
        delete nextLines[tabId]
        return nextLines
      })
      if (validationTimersRef.current[tabId]) clearTimeout(validationTimersRef.current[tabId])
      delete validationTimersRef.current[tabId]
      onTabClosed?.(tabId)
      if (tabId === activeTabId) setActiveTabId(nextTabs[Math.min(closingIndex, nextTabs.length - 1)].id)
    },
    [activeTabId, onTabClosed, tabs]
  )

  return useMemo(
    () => ({
      tabs,
      activeTab,
      activeFeedback,
      markerErrorLines,
      setTabs,
      setActiveTabId,
      setTabFeedback,
      setMarkerErrorLines,
      updateValue,
      showJsonError,
      addTab,
      renameTab,
      closeTab
    }),
    [
      tabs,
      activeTab,
      activeFeedback,
      markerErrorLines,
      setTabFeedback,
      setMarkerErrorLines,
      updateValue,
      showJsonError,
      addTab,
      renameTab,
      closeTab
    ]
  )
}
