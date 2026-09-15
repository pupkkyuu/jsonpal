import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createTabId, INITIAL_TAB, WAITING_FEEDBACK, type JsonTab, type TabFeedback } from '@/jsonUtils'

interface TabState {
  feedback: TabFeedback
  errorLines: number[]
}

interface UseJsonTabsResult {
  tabs: JsonTab[]
  activeTab: JsonTab
  activeFeedback: TabFeedback
  markerErrorLines: number[]
  setTabs: (tabs: JsonTab[]) => void
  setActiveTabId: (id: string) => void
  setTabFeedback: (tabId: string, feedback: TabFeedback) => void
  setMarkerErrorLines: (tabId: string, lines: number[]) => void
  addTab: () => void
  renameTab: (tabId: string, title: string) => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
}

const EMPTY_ERROR_LINES: number[] = []

function areFeedbacksEqual(a: TabFeedback, b: TabFeedback): boolean {
  return a.message === b.message && a.isValid === b.isValid && a.parseErrorLine === b.parseErrorLine
}

function areErrorLinesEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index])
}

export function useJsonTabs(onTabClosed?: (tabId: string) => void): UseJsonTabsResult {
  const [tabs, setTabs] = useState<JsonTab[]>([INITIAL_TAB])
  const [activeTabId, setActiveTabId] = useState(INITIAL_TAB.id)
  const [statesByTab, setStatesByTab] = useState<Record<string, TabState>>({
    [INITIAL_TAB.id]: { feedback: WAITING_FEEDBACK, errorLines: EMPTY_ERROR_LINES }
  })
  const untitledCounterRef = useRef(2)
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)

  useEffect(() => {
    tabsRef.current = tabs
    activeTabIdRef.current = activeTabId
  }, [tabs, activeTabId])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!
  const activeState = statesByTab[activeTab.id]
  const activeFeedback = activeState?.feedback ?? WAITING_FEEDBACK
  const markerErrorLines = activeState?.errorLines ?? EMPTY_ERROR_LINES

  const setTabFeedback = useCallback((tabId: string, feedback: TabFeedback) => {
    setStatesByTab((current) => {
      const previous = current[tabId]
      if (previous && areFeedbacksEqual(previous.feedback, feedback)) return current
      return { ...current, [tabId]: { feedback, errorLines: previous?.errorLines ?? EMPTY_ERROR_LINES } }
    })
  }, [])

  const setMarkerErrorLines = useCallback((tabId: string, lines: number[]) => {
    setStatesByTab((current) => {
      const previous = current[tabId]?.errorLines ?? EMPTY_ERROR_LINES
      if (areErrorLinesEqual(previous, lines)) return current
      return { ...current, [tabId]: { feedback: current[tabId]?.feedback ?? WAITING_FEEDBACK, errorLines: lines } }
    })
  }, [])

  const addTab = useCallback(() => {
    const tab: JsonTab = { id: createTabId(), title: `未命名 ${untitledCounterRef.current++}` }
    setTabs((current) => [...current, tab])
    setStatesByTab((current) => ({ ...current, [tab.id]: { feedback: WAITING_FEEDBACK, errorLines: EMPTY_ERROR_LINES } }))
    setActiveTabId(tab.id)
  }, [])

  const renameTab = useCallback((tabId: string, title: string) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)))
  }, [])

  const closeTab = useCallback(
    (tabId: string) => {
      const currentTabs = tabsRef.current
      const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId)
      if (closingIndex === -1) return

      let nextTabs = currentTabs.filter((tab) => tab.id !== tabId)
      if (nextTabs.length === 0) {
        nextTabs = [{ id: createTabId(), title: `未命名 ${untitledCounterRef.current++}` }]
      }

      setTabs(nextTabs)
      setStatesByTab((current) => {
        const nextStates = { ...current }
        delete nextStates[tabId]
        if (!nextStates[nextTabs[0].id]) {
          nextStates[nextTabs[0].id] = { feedback: WAITING_FEEDBACK, errorLines: EMPTY_ERROR_LINES }
        }
        return nextStates
      })
      onTabClosed?.(tabId)
      if (tabId === activeTabIdRef.current) {
        setActiveTabId(nextTabs[Math.min(closingIndex, nextTabs.length - 1)].id)
      }
    },
    [onTabClosed]
  )

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      const currentTabs = tabsRef.current
      const remainingTab = currentTabs.find((tab) => tab.id === tabId)
      if (!remainingTab) return

      const closedTabIds = currentTabs.filter((tab) => tab.id !== tabId).map((tab) => tab.id)
      if (closedTabIds.length === 0) return

      setTabs([remainingTab])
      setStatesByTab((current) => {
        const remainingState = current[tabId] ?? { feedback: WAITING_FEEDBACK, errorLines: EMPTY_ERROR_LINES }
        return { [tabId]: remainingState }
      })
      setActiveTabId(tabId)
      closedTabIds.forEach((closedTabId) => onTabClosed?.(closedTabId))
    },
    [onTabClosed]
  )

  const closeAllTabs = useCallback(() => {
    const closedTabIds = tabsRef.current.map((tab) => tab.id)
    const replacementTab: JsonTab = { id: createTabId(), title: `未命名 ${untitledCounterRef.current++}` }

    setTabs([replacementTab])
    setStatesByTab({ [replacementTab.id]: { feedback: WAITING_FEEDBACK, errorLines: EMPTY_ERROR_LINES } })
    setActiveTabId(replacementTab.id)
    closedTabIds.forEach((closedTabId) => onTabClosed?.(closedTabId))
  }, [onTabClosed])

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
      addTab,
      renameTab,
      closeTab,
      closeOtherTabs,
      closeAllTabs
    }),
    [
      tabs,
      activeTab,
      activeFeedback,
      markerErrorLines,
      setTabs,
      setActiveTabId,
      setTabFeedback,
      setMarkerErrorLines,
      addTab,
      renameTab,
      closeTab,
      closeOtherTabs,
      closeAllTabs
    ]
  )
}
