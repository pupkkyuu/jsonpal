import {
  AlignJustify,
  ArrowLeft,
  Braces,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Eye,
  FolderOpen,
  ListOrdered,
  PanelRight,
  PanelLeft,
  Rows3,
  ShieldCheck,
  Type
} from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Switch } from '@/components/ui/switch'
import {
  type EditorSettings,
  type LineNumberMode,
  type WhitespaceMode
} from '@/editorSettings'
import { IS_MACOS } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'
import type { AppInfo } from '../../preload/index.d'

interface SettingRowProps {
  icon: typeof Eye
  label: string
  children: ReactNode
}

function SettingRow({ icon: Icon, label, children }: SettingRowProps): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-center justify-between gap-6 border-b border-[var(--border-default)] py-2.5 last:border-b-0">
      <div className="flex items-center gap-3 text-sm font-medium text-[var(--text-primary)]">
        <Icon size={16} className="text-[var(--text-secondary)]" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  )
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section>
      <h2 className="mb-3 text-left text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  )
}

interface SettingsFormProps {
  settings: EditorSettings
  updateSettings: (patch: Partial<EditorSettings>) => void
}

function SettingsForm({ settings, updateSettings }: SettingsFormProps): React.JSX.Element {
  return (
    <div className="space-y-8">
      <SettingsGroup title="显示">
        <SettingRow icon={PanelRight} label="缩略预览">
        <Switch checked={settings.minimap} onCheckedChange={(minimap) => updateSettings({ minimap })} aria-label="缩略预览" />
        </SettingRow>
        <SettingRow icon={AlignJustify} label="缩略预览字符">
        <Switch
          checked={settings.minimapCharacters}
          onCheckedChange={(minimapCharacters) => updateSettings({ minimapCharacters })}
          aria-label="缩略预览字符"
          disabled={!settings.minimap}
        />
        </SettingRow>
        <SettingRow icon={Rows3} label="粘滞滚动">
        <Switch checked={settings.stickyScroll} onCheckedChange={(stickyScroll) => updateSettings({ stickyScroll })} aria-label="粘滞滚动" />
        </SettingRow>
        <SettingRow icon={Rows3} label="代码折叠">
        <Switch checked={settings.folding} onCheckedChange={(folding) => updateSettings({ folding })} aria-label="代码折叠" />
        </SettingRow>
        <SettingRow icon={Eye} label="空白字符">
        <select
          value={settings.renderWhitespace}
          onChange={(event) => updateSettings({ renderWhitespace: event.target.value as WhitespaceMode })}
          className="h-8 rounded-lg border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent)]/15"
          aria-label="空白字符显示方式"
        >
          <option value="none">不显示</option>
          <option value="boundary">边界显示</option>
          <option value="all">全部显示</option>
        </select>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="编辑行为">
        <SettingRow icon={Braces} label="括号配对着色">
        <Switch
          checked={settings.bracketPairColorization}
          onCheckedChange={(bracketPairColorization) => updateSettings({ bracketPairColorization })}
          aria-label="括号配对着色"
        />
        </SettingRow>
        <SettingRow icon={Braces} label="括号缩进引导线">
        <Switch checked={settings.bracketGuides} onCheckedChange={(bracketGuides) => updateSettings({ bracketGuides })} aria-label="括号缩进引导线" />
        </SettingRow>
        <SettingRow icon={ListOrdered} label="行号">
        <select
          value={settings.lineNumbers}
          onChange={(event) => updateSettings({ lineNumbers: event.target.value as LineNumberMode })}
          className="h-8 rounded-lg border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent)]/15"
          aria-label="行号显示方式"
        >
          <option value="on">绝对行号</option>
          <option value="relative">相对行号</option>
        </select>
        </SettingRow>
        <SettingRow icon={ClipboardPaste} label="粘贴时格式化">
        <Switch checked={settings.formatOnPaste} onCheckedChange={(formatOnPaste) => updateSettings({ formatOnPaste })} aria-label="粘贴时格式化" />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="辅助功能">
        <SettingRow icon={ShieldCheck} label="可疑 Unicode 高亮">
        <Switch checked={settings.unicodeHighlight} onCheckedChange={(unicodeHighlight) => updateSettings({ unicodeHighlight })} aria-label="可疑 Unicode 高亮" />
        </SettingRow>
        <SettingRow icon={Type} label="字体大小">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="12"
            max="24"
            step="1"
            value={settings.fontSize}
            onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
            className="w-28 accent-[var(--accent)]"
            aria-label="字体大小"
          />
          <output className="w-9 text-right text-sm tabular-nums text-[var(--text-secondary)]">{settings.fontSize}px</output>
        </div>
        </SettingRow>
        <SettingRow icon={Rows3} label="滚动条宽度">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="8"
            max="20"
            step="1"
            value={settings.scrollbarSize}
            onChange={(event) => updateSettings({ scrollbarSize: Number(event.target.value) })}
            className="w-28 accent-[var(--accent)]"
            aria-label="滚动条宽度"
          />
          <output className="w-5 text-right text-sm tabular-nums text-[var(--text-secondary)]">{settings.scrollbarSize}</output>
        </div>
        </SettingRow>
      </SettingsGroup>
    </div>
  )
}

function getConfigPathDisplay(configPath: string): { filename: string; directory: string } {
  if (!configPath) return { filename: '正在读取...', directory: '' }

  const normalizedPath = configPath.replaceAll('\\', '/')
  const separatorIndex = normalizedPath.lastIndexOf('/')
  const filename = normalizedPath.slice(separatorIndex + 1) || normalizedPath
  const directory = separatorIndex >= 0 ? `${normalizedPath.slice(0, separatorIndex + 1)}` : ''
  const homeDirectoryMatch = directory.match(/^\/(?:Users|home)\/[^/]+(\/.*)$/)

  return {
    filename,
    directory: homeDirectoryMatch ? `~${homeDirectoryMatch[1]}` : directory
  }
}

function GeneralSettings({ configPath, onOpenFolder }: { configPath: string; onOpenFolder: () => void }): React.JSX.Element {
  const [isPathExpanded, setIsPathExpanded] = useState(false)
  const [isPathCopied, setIsPathCopied] = useState(false)
  const { filename, directory } = getConfigPathDisplay(configPath)

  const copyPath = async (): Promise<void> => {
    if (!configPath) return
    await navigator.clipboard.writeText(configPath)
    setIsPathCopied(true)
    window.setTimeout(() => setIsPathCopied(false), 1500)
  }

  return (
    <SettingsGroup title="配置文件路径">
        <div className="flex min-h-24 flex-col gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--text-primary)]">{filename}</div>
            <div className="mt-1.5 flex h-8 min-w-0 items-center text-xs text-[var(--text-secondary)]">
              <span title={directory} className="min-w-0 flex-1 truncate">{directory}</span>
              <button
                type="button"
                className="app-no-drag ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-capsule-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                onClick={() => setIsPathExpanded((expanded) => !expanded)}
                disabled={!configPath}
                aria-expanded={isPathExpanded}
                aria-label={isPathExpanded ? '收起完整路径' : '展开完整路径'}
              >
                <ChevronRight size={15} className={`transition-transform duration-200 ${isPathExpanded ? 'rotate-90' : ''}`} />
              </button>
            </div>
            <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${isPathExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="min-h-0 overflow-hidden">
                <p className="pt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">{configPath}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copyPath()} disabled={!configPath}>
              <Copy size={16} />
              {isPathCopied ? '已复制' : '复制路径'}
            </Button>
            <Button variant="outline" onClick={onOpenFolder} disabled={!configPath}>
              <FolderOpen size={16} />
              打开文件夹
            </Button>
          </div>
        </div>
    </SettingsGroup>
  )
}

interface ShortcutRowProps {
  label: string
  keys: string[]
}

function ShortcutRow({ label, keys }: ShortcutRowProps): React.JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 border-b border-[var(--border-divider)] py-3 last:border-b-0">
      <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        {keys.map((key, index) => (
          <Fragment key={`${index}-${key}`}>
            {index > 0 && <span className="text-xs text-[var(--text-tertiary)]">+</span>}
            <kbd className="rounded-sm border border-[var(--border-default)] bg-[var(--bg-capsule)] px-1.5 py-0.5 font-sans text-xs font-medium text-[var(--text-primary)]">
              {key}
            </kbd>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function ShortcutsSection(): React.JSX.Element {
  const modifier = IS_MACOS ? '⌘' : 'Ctrl'
  const shift = IS_MACOS ? '⇧' : 'Shift'
  const tabModifier = IS_MACOS ? 'Control' : modifier

  return (
    <SettingsGroup title="快捷键说明">
        <ShortcutRow label="新建 Tab" keys={[modifier, 'T']} />
        <ShortcutRow label="切换到下一个 Tab" keys={[tabModifier, 'Tab']} />
        <ShortcutRow label="切换到第 N 个 Tab" keys={[tabModifier, '1-9']} />
        <ShortcutRow label="收起 / 展开侧边栏" keys={[modifier, 'B']} />
        <ShortcutRow label="格式化 JSON" keys={[modifier, shift, 'F']} />
        <ShortcutRow label="压缩 JSON" keys={[modifier, shift, 'M']} />
    </SettingsGroup>
  )
}

function AboutSection(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let isMounted = true
    void window.api.app.info().then((result) => {
      if (isMounted) setInfo(result)
    }).catch(() => {
      if (isMounted) setLoadFailed(true)
    })
    return () => { isMounted = false }
  }, [])

  return (
    <SettingsGroup title="关于 JSONPal">
      {info ? (
        <dl className="space-y-3 text-sm">
          {[
            ['版本', info.version],
            ['作者', info.authorEmail]
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-6">
              <dt className="text-[var(--text-secondary)]">{label}</dt>
              <dd className="min-w-0 break-all text-right text-[var(--text-primary)]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p role="status" className="text-sm text-[var(--text-secondary)]">{loadFailed ? '无法读取应用信息' : '正在读取应用信息…'}</p>
      )}
    </SettingsGroup>
  )
}

interface SettingsAppProps {
  onBack: () => void
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  updateSettings: (patch: Partial<EditorSettings>) => void
  saveError: string
}

function SettingsApp({ onBack, isSidebarCollapsed, onToggleSidebar, updateSettings, saveError }: SettingsAppProps): React.JSX.Element {
  const [configPath, setConfigPath] = useState('')
  const settings = useWorkspaceStore((state) => state.settings)

  useEffect(() => {
    let isMounted = true
    void window.api.settings.path().then((path) => {
      if (isMounted) setConfigPath(path)
    })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="settings-page flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" aria-label="设置页面">
      <header className={`workspace-toolbar app-drag-region ${IS_MACOS && isSidebarCollapsed ? 'traffic-light-inset' : ''}`} data-sidebar-collapsed={isSidebarCollapsed}>
        <div className="workspace-sidebar-toggle" inert={!isSidebarCollapsed} aria-hidden={!isSidebarCollapsed}>
          <IconButton className="sidebar-toggle" label="显示侧边栏" onClick={onToggleSidebar} aria-expanded={false} aria-controls="tab-sidebar" tabIndex={isSidebarCollapsed ? 0 : -1}><PanelLeft size={18} /></IconButton>
        </div>
        <IconButton className="settings-back-button" label="返回编辑器" onClick={onBack}>
          <ArrowLeft size={18} />
        </IconButton>
        <h1 className="text-sm font-semibold text-[var(--text-primary)]">设置</h1>
        <span role="status" className="ml-auto text-xs text-[var(--danger)]">{saveError}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-label="设置内容">
        <div className="mx-auto w-full max-w-xl space-y-8 px-6 py-8">
          <GeneralSettings configPath={configPath} onOpenFolder={() => void window.api.settings.openFolder()} />
          <SettingsForm settings={settings} updateSettings={updateSettings} />
          <ShortcutsSection />
          <AboutSection />
        </div>
      </div>
    </section>
  )
}

export default SettingsApp
