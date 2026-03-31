import type { Metadata } from 'next'
import Link from 'next/link'
import { TrialWidget } from '@/features/rewrite/trial-widget'

export const metadata: Metadata = {
  title: '适文 - 小红书文章改写成公众号 | AI 多平台内容适配',
  description:
    '适文 AI 帮你把小红书文章改写为公众号、知乎原生内容。语义级改写，保留观点，适配平台风格。粘贴文章，4 步完成。',
}

const PLATFORMS = [
  { name: '小红书', desc: '轻量风格，多段落，标签丰富', dot: '#ff2442' },
  { name: '微信公众号', desc: '正式排版，适合深度内容', dot: '#07c160' },
  { name: '知乎', desc: '理性论述，适合观点分析', dot: '#0066ff' },
]

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: '语义级改写',
    desc: '不是句子替换，而是理解内容后重新表达，保留核心观点',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
    title: '零学习成本',
    desc: '粘贴文章、选平台、复制结果，4 步完成，无需写提示词',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="4" width="5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: '多平台一键',
    desc: '一次输入，同时生成三平台原生内容，告别反复改稿',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 bg-gradient-to-b from-accent-muted to-white">
        {/* Badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-accent/25 text-accent text-xs font-medium mb-8 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
          AI 驱动 · 语义级改写
        </span>

        <h1 className="text-5xl font-bold text-gray-900 mb-3 tracking-tight">适文</h1>
        <p className="text-2xl font-semibold text-gray-700 mb-5">
          一篇文章{' '}
          <span className="text-accent">→</span>
          {' '}多平台原生内容
        </p>
        <p className="text-base text-gray-500 max-w-md mb-10 leading-relaxed">
          把你的小红书文章自动改写为公众号、知乎的原生风格内容。
          <br />
          语义级重写，风格精准适配，无需手动调整。
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-lg bg-accent text-white font-semibold text-base hover:bg-accent-hover transition-colors shadow-sm"
        >
          免费试用
        </Link>
        <div className="mt-10 w-full max-w-2xl">
          <TrialWidget />
        </div>
      </section>

      {/* Platforms */}
      <section className="bg-surface-2 py-16 px-6 border-t border-border-default">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-gray-800 mb-8 text-center">支持平台</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="bg-white rounded-xl border border-border-default p-5 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mb-3"
                  style={{ backgroundColor: p.dot }}
                />
                <h3 className="font-semibold text-gray-800 mb-1">{p.name}</h3>
                <p className="text-sm text-text-secondary">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-gray-800 mb-8 text-center">为什么选适文</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-light text-accent">
                  {f.icon}
                </span>
                <h3 className="font-semibold text-gray-800">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-surface-2 border-t border-border-default py-12 px-6 text-center">
        <p className="text-gray-600 mb-4">立即体验 AI 驱动的多平台内容改写</p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-lg bg-accent text-white font-semibold text-base hover:bg-accent-hover transition-colors shadow-sm"
        >
          立即注册，免费体验
        </Link>
      </section>
    </main>
  )
}
