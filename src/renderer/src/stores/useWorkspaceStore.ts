import { create } from 'zustand'
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from '@/editorSettings'
import { createTabId, INITIAL_TAB, WAITING_FEEDBACK, type JsonTab, type TabFeedback } from '@/jsonUtils'

interface TabState {
  feedback: TabFeedback
  errorLines: number[]
}

export interface ToastNotice {
  message: string
  tone: 'success' | 'error'
}

interface WorkspaceState {
  tabs: JsonTab[]
  activeTabId: string
  statesByTab: Record<string, TabState>
  settings: EditorSettings
  isSidebarCollapsed: boolean
  sidebarWidth: number
  toast: ToastNotice | null
  setTabs: (tabs: JsonTab[]) => void
  setActiveTabId: (id: string) => void
  setTabFeedback: (tabId: string, feedback: TabFeedback) => void
  setTabValidation: (tabId: string, feedback: TabFeedback, errorLines: number[]) => void
  addTab: () => void
  renameTab: (tabId: string, title: string) => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  setSettings: (settings: EditorSettings) => void
  updateSettings: (patch: Partial<EditorSettings>) => void
  setSidebarCollapsed: (isCollapsed: boolean) => void
  setSidebarWidth: (width: number) => void
  setToast: (toast: ToastNotice | null) => void
}

function areFeedbacksEqual(a: TabFeedback, b: TabFeedback): boolean {
  return a.message === b.message && a.isValid === b.isValid && a.parseErrorLine === b.parseErrorLine
}

function areErrorLinesEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index])
}

function createUntitledTab(number: number): JsonTab {
  return { id: createTabId(), title: `未命名 ${number}` }
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
    sidebarWidth: 200,
    toast: null,
    setTabs: (tabs) => set({ tabs }),
    setActiveTabId: (activeTabId) => set({ activeTabId }),
    setTabFeedback: (tabId, feedback) => {
      const previous = get().statesByTab[tabId]
      if (previous && areFeedbacksEqual(previous.feedback, feedback)) return
      set((state) => ({
        statesByTab: {
          ...state.statesByTab,
          [tabId]: { feedback, errorLines: previous?.errorLines ?? [] }
        }
      }))
    },
    setTabValidation: (tabId, feedback, errorLines) => {
      const previous = get().statesByTab[tabId]
      if (previous && areFeedbacksEqual(previous.feedback, feedback) && areErrorLinesEqual(previous.errorLines, errorLines)) return
      set((state) => ({
        statesByTab: {
          ...state.statesByTab,
          [tabId]: { feedback, errorLines }
        }
      }))
    },
    addTab: () => {
      const tab = createUntitledTab(untitledCounter++)
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
    setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
    setToast: (toast) => set({ toast })
  }
})
