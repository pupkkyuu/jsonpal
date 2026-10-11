import { create } from 'zustand'
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from '@/editorSettings'
import { createTabId, INITIAL_TAB, WAITING_FEEDBACK, type CompareViewMode, type JsonTab, type TabFeedback } from '@/jsonUtils'

interface TabState {
  feedback: TabFeedback
  errorLines: number[]
  compareMode?: CompareViewMode
}

interface WorkspaceState {
  tabs: JsonTab[]
  activeTabId: string
  statesByTab: Record<string, TabState>
  settings: EditorSettings
  isSidebarCollapsed: boolean
  sidebarWidth: number
  setTabs: (tabs: JsonTab[]) => void
  setActiveTabId: (id: string) => void
  setTabFeedback: (tabId: string, feedback: TabFeedback) => void
  setTabValidation: (tabId: string, feedback: TabFeedback, errorLines: number[]) => void
  setCompareMode: (tabId: string, mode: CompareViewMode) => void
  addTab: () => void
  addDiffTab: () => void
  renameTab: (tabId: string, title: string) => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  setSettings: (settings: EditorSettings) => void
  updateSettings: (patch: Partial<EditorSettings>) => void
  setSidebarCollapsed: (isCollapsed: boolean) => void
  setSidebarWidth: (width: number) => void
}

function areFeedbacksEqual(a: TabFeedback, b: TabFeedback): boolean {
  return a.message === b.message && a.isValid === b.isValid && a.parseErrorLine === b.parseErrorLine
}

function areErrorLinesEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index])
}

function createUntitledTab(number: number): JsonTab {
  return { id: createTabId(), title: `格式化 ${number}`, kind: 'json' }
}

function createDiffTab(number: number): JsonTab {
  return { id: createTabId(), title: `对比 ${number}`, kind: 'diff' }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  let untitledCounter = 2

  return {
    tabs: [INITIAL_TAB],
    activeTabId: INITIAL_TAB.id,
    statesByTab: {
      [INITIAL_TAB.id]: { feedback: WAITING_FEEDBACK, errorLines: [] }
    },
    settings: DEFAULT_EDITOR_SETTINGS,
    isSidebarCollapsed: false,
    sidebarWidth: 180,
    setTabs: (tabs) => set({ tabs }),
    setActiveTabId: (activeTabId) => set({ activeTabId }),
    setTabFeedback: (tabId, feedback) => {
      const previous = get().statesByTab[tabId]
      if (previous && areFeedbacksEqual(previous.feedback, feedback)) return
      // Keep the record identity stable so an update is O(1). Consumers should
      // select an individual tab state rather than the complete record.
      set((state) => {
        state.statesByTab[tabId] = { ...previous, feedback, errorLines: previous?.errorLines ?? [] }
        return { statesByTab: state.statesByTab }
      })
    },
    setTabValidation: (tabId, feedback, errorLines) => {
      const previous = get().statesByTab[tabId]
      if (previous && areFeedbacksEqual(previous.feedback, feedback) && areErrorLinesEqual(previous.errorLines, errorLines)) return
      set((state) => {
        state.statesByTab[tabId] = { ...previous, feedback, errorLines }
        return { statesByTab: state.statesByTab }
      })
    },
    setCompareMode: (tabId, compareMode) => {
      const previous = get().statesByTab[tabId]
      if (!previous || previous.compareMode === compareMode) return
      set((state) => {
        state.statesByTab[tabId] = { ...previous, compareMode }
        return { statesByTab: state.statesByTab }
      })
    },
    addTab: () => {
      const tab = createUntitledTab(untitledCounter++)
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
        statesByTab: { ...state.statesByTab, [tab.id]: { feedback: WAITING_FEEDBACK, errorLines: [] } }
      }))
    },
    addDiffTab: () => {
      const tab = createDiffTab(untitledCounter++)
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
        statesByTab: { ...state.statesByTab, [tab.id]: { feedback: WAITING_FEEDBACK, errorLines: [] } }
      }))
    },
    renameTab: (tabId, title) => set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
    })),
    closeTab: (tabId) => {
      const { tabs, activeTabId, statesByTab } = get()
      const closingIndex = tabs.findIndex((tab) => tab.id === tabId)
      if (closingIndex === -1) return

      let nextTabs = tabs.filter((tab) => tab.id !== tabId)
      if (nextTabs.length === 0) nextTabs = [createUntitledTab(untitledCounter++)]
      const nextStates = { ...statesByTab }
      delete nextStates[tabId]
      if (!nextStates[nextTabs[0]!.id]) nextStates[nextTabs[0]!.id] = { feedback: WAITING_FEEDBACK, errorLines: [] }
      set({
        tabs: nextTabs,
        activeTabId: tabId === activeTabId ? nextTabs[Math.min(closingIndex, nextTabs.length - 1)]!.id : activeTabId,
        statesByTab: nextStates
      })
    },
    closeOtherTabs: (tabId) => {
      const { tabs, statesByTab } = get()
      const tab = tabs.find((current) => current.id === tabId)
      if (!tab) return
      set({
        tabs: [tab],
        activeTabId: tabId,
        statesByTab: { [tabId]: statesByTab[tabId] ?? { feedback: WAITING_FEEDBACK, errorLines: [] } }
      })
    },
    closeAllTabs: () => {
      const tab = createUntitledTab(untitledCounter++)
      set({
        tabs: [tab],
        activeTabId: tab.id,
        statesByTab: { [tab.id]: { feedback: WAITING_FEEDBACK, errorLines: [] } }
      })
    },
    setSettings: (settings) => set({ settings }),
    updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
    setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
    setSidebarWidth: (sidebarWidth) => set({ sidebarWidth })
  }
})
