'use client'

import { useEffect } from 'react'

export function CustomJsInjector({ code }: { code: string }) {
  useEffect(() => {
    if (!code) return
    if (code.includes('<')) {
      // HTML 标签格式（如 <script src="...">）
      const frag = document.createRange().createContextualFragment(code)
      document.body.appendChild(frag)
    } else {
      // 纯 JS 代码
      const el = document.createElement('script')
      el.textContent = code
      document.body.appendChild(el)
    }
  }, [code])

  return null
}
