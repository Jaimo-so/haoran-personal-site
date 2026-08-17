'use client'

import { ApiTokensManager } from './ApiTokensManager'
import { WeChatBridgeManager } from './WeChatBridgeManager'

export function ThirdPartyPublishingManager() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[var(--editor-ink)]">外部工具 Token</h3>
          <p className="text-sm text-[var(--editor-muted)]">
            用于 Obsidian、浏览器插件、脚本或其他第三方工具调用博客后台接口。
          </p>
        </div>
        <div className="mt-5">
          <ApiTokensManager />
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[var(--editor-ink)]">公众号发布</h3>
          <p className="text-sm text-[var(--editor-muted)]">
            通过 bridge 统一管理多个公众号账号，并在编辑器里切换发布目标。
          </p>
        </div>
        <WeChatBridgeManager />
      </section>
    </div>
  )
}
