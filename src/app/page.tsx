import type { Metadata } from 'next'
import Link from 'next/link'
import { TrialWidget } from '@/features/rewrite/trial-widget'

export const metadata: Metadata = {
  title: '适文 - 小红书文章改写成公众号 | AI 多平台内容适配',
  description:
    '适文 AI 帮你把小红书文章改写为公众号、知乎原生内容。语义级改写，保留观点，适配平台风格。粘贴文章，4 步完成。',
}

const PLATFORMS = [
  { name: '小红书', desc: '轻量风格，多段落，标签丰富' },
  { name: '微信公众号', desc: '正式排版，适合深度内容' },
  { name: '知乎', desc: '理性论述，适合观点分析' },
]

const FEATURES = [
  { title: '语义级改写', desc: '不是句子替换，而是理解内容后重新表达，保留核心观点' },
  { title: '零学习成本', desc: '粘贴文章、选平台、复制结果，4 步完成，无需写提示词' },
  { title: '多平台一键', desc: '一次输入，同时生成三平台原生内容，告别反复改稿' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">适文</h1>
        <p className="text-2xl font-semibold text-gray-700 mb-6">
          一篇文章 → 多平台原生内容
        </p>
        <p className="text-base text-gray-500 max-w-md mb-10 leading-relaxed">
          把你的小红书文章自动改写为公众号、知乎的原生风格内容。
          <br />
          语义级重写，风格精准适配，无需手动调整。
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-lg bg-accent text-white font-semibold text-base hover:bg-accent-hover transition-colors"
        >
          免费试用
        </Link>
        <div className="mt-10 w-full max-w-2xl">
          <TrialWidget />
        </div>
      </section>

      {/* Platforms */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-gray-800 mb-8 text-center">支持平台</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="bg-white rounded-xl border border-gray-200 p-5 text-center"
              >
                <h3 className="font-medium text-gray-800 mb-1">{p.name}</h3>
                <p className="text-sm text-gray-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-gray-800 mb-8 text-center">为什么选适文</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="font-semibold text-gray-800 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gray-50 py-12 px-6 text-center">
        <p className="text-gray-600 mb-4">立即体验 AI 驱动的多平台内容改写</p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-lg bg-accent text-white font-semibold text-base hover:bg-accent-hover transition-colors"
        >
          立即注册，免费体验
        </Link>
      </section>
    </main>
  )
}
