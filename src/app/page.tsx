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
  { num: '01', title: '语义级改写', desc: '不是句子替换，而是理解内容后重新表达，保留核心观点' },
  { num: '02', title: '零学习成本', desc: '粘贴文章、选平台、复制结果，4 步完成，无需写提示词' },
  { num: '03', title: '多平台一键', desc: '一次输入，同时生成三平台原生内容，告别反复改稿' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-20 pb-16 bg-paper overflow-hidden">
        {/* 绿色光晕背景 */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(61,107,79,0.08) 0%, transparent 65%)',
          }}
        />

        {/* 眉标 */}
        <div className="relative flex items-center gap-2.5 mb-9">
          <span className="h-px w-7 bg-accent/35" />
          <span className="text-[11px] tracking-[0.22em] uppercase text-accent font-medium">
            AI 驱动 · 语义级改写
          </span>
          <span className="h-px w-7 bg-accent/35" />
        </div>

        {/* 主标题 */}
        <h1 className="relative text-[5.5rem] leading-none font-bold text-ink tracking-tight mb-4">
          适文
        </h1>

        {/* 副标题：圆形箭头 */}
        <p className="relative flex items-center justify-center gap-2.5 text-[1.3rem] font-medium text-ink/70 mb-4">
          一篇文章
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent text-white text-[15px] font-bold flex-shrink-0 shadow-sm"
            aria-hidden="true"
          >
            →
          </span>
          多平台原生内容
        </p>

        {/* 描述 */}
        <p className="relative text-[14px] text-ink/42 max-w-[390px] mb-9 leading-[1.95] tracking-[0.01em]">
          把你的小红书文章自动改写为公众号、知乎的原生风格内容。
          <br />
          语义级重写，风格精准适配，无需手动调整。
        </p>

        {/* 主 CTA */}
        <Link
          href="/login"
          className="relative inline-flex items-center gap-2 px-7 py-[11px] rounded-full bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-all duration-200 shadow-[0_2px_14px_rgba(61,107,79,0.28)] hover:shadow-[0_4px_22px_rgba(61,107,79,0.38)] hover:-translate-y-px mb-11"
        >
          免费试用
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            aria-hidden="true"
            className="opacity-90"
          >
            <path
              d="M1.5 6.5h10M7.5 2.5l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        {/* 试用 Widget 卡片 */}
        <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-[0_2px_32px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.05)] overflow-hidden">
          <TrialWidget />
        </div>
      </section>

      {/* ── 支持平台 ── */}
      <section className="bg-surface-2 py-16 px-6 border-t border-border-default">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-px flex-1 bg-border-default" />
            <h2 className="text-[11px] tracking-[0.22em] uppercase text-text-caption font-medium whitespace-nowrap">
              支持平台
            </h2>
            <span className="h-px flex-1 bg-border-default" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="group bg-white rounded-xl border border-border-default px-4 py-4 flex items-start gap-3 hover:border-accent/28 hover:shadow-sm transition-all duration-200 cursor-default"
              >
                <span
                  className="mt-[5px] w-[7px] h-[7px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.dot }}
                />
                <div>
                  <h3 className="font-semibold text-ink text-[13px] mb-0.5">{p.name}</h3>
                  <p className="text-[12px] text-text-secondary leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 为什么选适文 ── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <span className="h-px flex-1 bg-border-default" />
            <h2 className="text-[11px] tracking-[0.22em] uppercase text-text-caption font-medium whitespace-nowrap">
              为什么选适文
            </h2>
            <span className="h-px flex-1 bg-border-default" />
          </div>

          <div className="divide-y divide-border-default">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-5 py-6">
                <span className="text-[11px] font-mono text-accent/38 mt-[3px] w-6 flex-shrink-0 tabular-nums">
                  {f.num}
                </span>
                <div>
                  <h3 className="font-semibold text-ink text-[13.5px] mb-1.5">{f.title}</h3>
                  <p className="text-[13px] text-text-secondary leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 底部 CTA ── */}
      <section className="bg-accent py-14 px-6 text-center">
        <p className="text-white/65 text-[12px] tracking-[0.18em] uppercase mb-5">
          立即体验 AI 驱动的多平台内容改写
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-accent font-semibold text-sm hover:bg-accent-light transition-all duration-200 shadow-sm"
        >
          立即注册，免费体验
        </Link>
      </section>
    </main>
  )
}
