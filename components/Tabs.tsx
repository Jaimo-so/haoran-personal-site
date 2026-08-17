'use client'

import { useState, ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const activeContent = tabs.find(t => t.id === activeTab)?.content

  return (
    <div>
      {/* Tab 导航 */}
      <div className="border-b border-[var(--editor-line)] mb-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-[var(--editor-accent)]'
                  : 'text-[var(--editor-muted)] hover:text-[var(--editor-ink)]'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--editor-accent)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容 */}
      <div>{activeContent}</div>
    </div>
  )
}
