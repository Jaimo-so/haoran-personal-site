'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Download, Loader2, X } from 'lucide-react'

export function WechatImportButton() {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ slug: string; warnings: string[] } | null>(null)

  const openEditor = (slug: string) => {
    dialog.current?.close()
    router.push(`/editor?edit=${encodeURIComponent(slug)}`)
    router.refresh()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current || result) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/import/wechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await response.json() as { error?: string; code?: string; slug?: string; warnings?: string[] }
      if (!response.ok || !data.slug) {
        throw new Error(response.status === 401 ? '登录已过期，请重新登录后台后导入。' : data.error || '导入失败，请重试。')
      }
      if (data.warnings?.length) {
        setResult({ slug: data.slug, warnings: data.warnings })
        router.refresh()
      } else openEditor(data.slug)
    } catch (error) {
      setError(error instanceof Error ? error.message : '网络不可用，请稍后重试。')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const fieldClass = 'w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--editor-accent)]'
  const buttonClass = 'rounded-lg px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--editor-accent)] disabled:opacity-60'

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(''); dialog.current?.showModal() }}
        className={`${buttonClass} inline-flex shrink-0 items-center justify-center gap-2 border border-[var(--editor-line)] text-[var(--editor-ink)] hover:bg-[var(--editor-soft)]`}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        转载公众号文章
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="wechat-import-title"
        aria-describedby="wechat-import-description"
        onCancel={(event) => { if (busy) event.preventDefault() }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-0 text-[var(--editor-ink)] shadow-xl backdrop:bg-black/40"
      >
        <div className="p-5 sm:p-7">
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 id="wechat-import-title" className="text-lg font-semibold">转载到个人网站</h2>
            <button type="button" aria-label="关闭导入窗口" disabled={busy} onClick={() => dialog.current?.close()} className="rounded p-1 text-[var(--editor-muted)] hover:bg-[var(--editor-soft)] focus-visible:outline-2 disabled:opacity-50">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p id="wechat-import-description" className="mb-6 text-sm leading-6 text-[var(--editor-muted)]">通过浏览器扩展，将你已打开的公众号文章自动转载到个人网站。标题、正文和图片自动获取，完成后进入编辑器，再点击「发布到网站」。</p>
          <div className="mb-6 space-y-3 rounded-xl border border-[var(--editor-line)] bg-[var(--editor-soft)] p-4 text-sm leading-6">
            <p className="font-medium">浏览器一键转载</p>
            <ol className="list-decimal space-y-2 pl-5 text-[var(--editor-muted)]">
              <li>下载并解压扩展，在 Chrome 的扩展管理页开启开发者模式，选择「加载已解压的扩展程序」。</li>
              <li>在扩展设置中填写本站地址和网站后台生成的 API Token，只需配置一次。</li>
              <li>在 Chrome 中打开公众号文章，正文正常显示后，点击扩展中的「转载到我的网站」。</li>
            </ol>
            <div className="flex flex-wrap gap-4">
              <a href="/downloads/haoran-wechat-clipper.zip" download className="font-medium text-[var(--editor-accent)] underline underline-offset-4">下载 Chrome 扩展</a>
              <Link href="/admin/settings" className="text-[var(--editor-accent)] underline underline-offset-4">打开网站设置</Link>
            </div>
          </div>
          {result ? (
            <div role="status" className="space-y-4">
              <p className="font-medium">已创建网站文章草稿</p>
              <p className="text-sm leading-6 text-[var(--editor-muted)]">打开文章核对内容，再点击「发布到网站」完成转载。</p>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--editor-muted)]">
                {result.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
              <button type="button" onClick={() => openEditor(result.slug)} className={`${buttonClass} bg-[var(--editor-accent)] text-white`}>编辑网站文章</button>
              <button type="button" onClick={() => { setResult(null); setUrl('') }} className={`${buttonClass} text-[var(--editor-muted)]`}>导入另一篇</button>
            </div>
          ) : (
            <details>
              <summary className="mb-4 cursor-pointer text-sm text-[var(--editor-muted)]">直接通过链接读取（微信验证时可能失败）</summary>
            <form onSubmit={submit} aria-busy={busy} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="wechat-import-url" className="block text-sm font-medium">公众号文章链接</label>
                <input id="wechat-import-url" type="url" required maxLength={4096} value={url} disabled={busy} onChange={event => { setUrl(event.target.value); setError('') }} placeholder="https://mp.weixin.qq.com/s/…" aria-invalid={Boolean(error)} aria-describedby={error ? 'wechat-import-error' : undefined} className={fieldClass} />
              </div>
              {error && <p id="wechat-import-error" role="alert" className="text-sm leading-6 text-rose-600 dark:text-rose-400">{error}</p>}
              {busy && <p role="status" className="text-sm text-[var(--editor-muted)]">正在读取正文并保存图片，请稍候…</p>}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button type="submit" disabled={busy} className={`${buttonClass} inline-flex items-center gap-2 bg-[var(--editor-accent)] text-white hover:brightness-105`}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {busy ? '正在导入…' : '导入到网站并编辑'}
                </button>
              </div>
            </form>
            </details>
          )}
        </div>
      </dialog>
    </>
  )
}
