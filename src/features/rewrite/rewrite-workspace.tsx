'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TextInput } from './text-input'
import { UrlInput } from './url-input'
import { PlatformSelector, type Platform } from './platform-selector'
import { ToneSelector, type Tone } from './tone-selector'
import { ContentPackage } from './content-package'
import { useRewriteStore } from './rewrite-store'
import { useRewriteStream } from './use-rewrite-stream'

const VALID_PLATFORMS: Platform[] = ['xiaohongshu', 'wechat', 'zhihu']
const VALID_TONES: Tone[] = ['casual', 'standard', 'formal']

const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}

export function RewriteWorkspace() {
  const searchParams = useSearchParams()

  const text = useRewriteStore((s) => s.text)
  const platforms = useRewriteStore((s) => s.platforms)
  const tone = useRewriteStore((s) => s.tone)
  const status = useRewriteStore((s) => s.status)
  const streamingTexts = useRewriteStore((s) => s.streamingTexts)
  const activeTab = useRewriteStore((s) => s.activeTab)
  const streamingPlatform = useRewriteStore((s) => s.streamingPlatform)
  const streamError = useRewriteStore((s) => s.streamError)
  const platformPackages = useRewriteStore((s) => s.platformPackages)
  const resultIds = useRewriteStore((s) => s.resultIds)

  const setText = useRewriteStore((s) => s.setText)
  const setPlatforms = useRewriteStore((s) => s.setPlatforms)
  const setTone = useRewriteStore((s) => s.setTone)
  const setActiveTab = useRewriteStore((s) => s.setActiveTab)

  const { startStream } = useRewriteStream()

  const [inputTab, setInputTab] = useState<'paste' | 'url'>('paste')
  const [urlExtractError, setUrlExtractError] = useState<string | null>(null)

  const handleUrlExtracted = (extractedText: string) => {
    setText(extractedText)
    setUrlExtractError(null)
    setInputTab('paste')
  }

  const handleUrlError = (message?: string) => {
    setUrlExtractError(message ?? null)
    setInputTab('paste')
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="原文输入框"]')
      ta?.focus()
    }, 50)
  }

  const prefillDoneRef = useRef(false)
  const [shouldAutoStart, setShouldAutoStart] = useState(false)

  useEffect(() => {
    if (prefillDoneRef.current) return
    prefillDoneRef.current = true

    const rawText = searchParams.get('text')
    if (rawText) setText([...rawText].slice(0, 5000).join(''))

    const rawPlatforms = searchParams.get('platforms')
    if (rawPlatforms) {
      const valid = rawPlatforms
        .split(',')
        .filter((p) => VALID_PLATFORMS.includes(p as Platform)) as Platform[]
      if (valid.length > 0) setPlatforms(valid)
    }

    const rawTone = searchParams.get('tone')
    if (rawTone && VALID_TONES.includes(rawTone as Tone)) setTone(rawTone as Tone)

    if (!rawText) {
      try {
        const trialRaw = localStorage.getItem('shiwen_trial_prefill')
        if (trialRaw) {
          localStorage.removeItem('shiwen_trial_prefill')
          const { text: t, platform: p, tone: tn } = JSON.parse(trialRaw) as {
            text?: unknown
            platform?: unknown
            tone?: unknown
          }
          if (typeof t === 'string' && [...t].length >= 50) {
            setText([...t].slice(0, 5000).join(''))
            if (typeof p === 'string' && VALID_PLATFORMS.includes(p as Platform))
              setPlatforms([p as Platform])
            if (typeof tn === 'string' && VALID_TONES.includes(tn as Tone))
              setTone(tn as Tone)
            setShouldAutoStart(true)
          }
        }
      } catch {
        /* ignore localStorage or parse errors */
      }
    }
  }, [searchParams, setText, setPlatforms, setTone])

  useEffect(() => {
    if (!shouldAutoStart) return
    if (status !== 'idle') return
    if ([...text].length < 50) return
    setShouldAutoStart(false)
    startStream()
  }, [shouldAutoStart, status, text, startStream])

  const charCount = useMemo(() => [...text].length, [text])
  const isTextValid = charCount >= 50 && charCount <= 5000
  const isRewriting = status === 'rewriting'
  const isDone = status === 'complete'
  const isDisabled = !isTextValid || platforms.length === 0 || isRewriting

  const hasResults = Object.keys(streamingTexts).length > 0 || isRewriting
  const hasPartialResults =
    streamError !== null && Object.keys(streamingTexts).length > 0

  return (
    <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* 页面标题 */}
      <div className="mb-1">
        <h1 className="text-[1.15rem] font-semibold text-ink tracking-tight">改写工作区</h1>
        <p className="text-[12.5px] text-text-caption mt-0.5">粘贴原文，选择平台，一键生成多平台内容</p>
      </div>

      {/* 主操作卡片 */}
      <div className="bg-white rounded-2xl border border-border-default shadow-[0_1px_12px_rgba(0,0,0,0.05)] overflow-hidden">

        {/* 输入方式 tab */}
        <div className="flex border-b border-border-default">
          {(['paste', 'url'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              disabled={isRewriting}
              onClick={() => { setInputTab(tab); setUrlExtractError(null) }}
              className={[
                'flex-1 py-2.5 text-center text-[12.5px] font-medium transition-all duration-150 relative',
                inputTab === tab
                  ? 'text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-accent after:content-[\'\']'
                  : 'text-text-caption hover:text-text-secondary bg-surface-2/50',
                isRewriting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              ].join(' ')}
            >
              {tab === 'paste' ? '粘贴全文' : 'URL 提取'}
            </button>
          ))}
        </div>

        {/* 输入区 */}
        <div className="p-4 flex flex-col gap-4">
          {inputTab === 'paste' ? (
            <>
              <TextInput value={text} onChange={setText} disabled={isRewriting} />
              {urlExtractError && (
                <p className="text-xs text-red-500 -mt-2">{urlExtractError}</p>
              )}
            </>
          ) : (
            <UrlInput
              onExtracted={handleUrlExtracted}
              onError={handleUrlError}
              disabled={isRewriting}
            />
          )}

          {/* 分隔线 */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border-default" />
            <span className="text-[10.5px] tracking-[0.15em] uppercase text-text-caption">配置</span>
            <span className="h-px flex-1 bg-border-default" />
          </div>

          <PlatformSelector value={platforms} onChange={setPlatforms} disabled={isRewriting} />
          <ToneSelector value={tone} onChange={setTone} disabled={isRewriting} />
        </div>

        {/* 提交按钮 */}
        <div className="px-4 pb-4">
          <button
            type="button"
            disabled={isDisabled}
            onClick={startStream}
            className="w-full py-3 rounded-full font-semibold text-[13px] tracking-wide transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed bg-accent text-white hover:bg-accent-hover active:scale-[0.98] shadow-[0_2px_10px_rgba(61,107,79,0.22)] hover:shadow-[0_3px_16px_rgba(61,107,79,0.32)]"
          >
            {isRewriting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:240ms]" />
                </span>
                改写中
              </span>
            ) : isDone ? '重新改写' : '开始改写'}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {streamError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="flex-1 text-[12.5px] text-red-700">{streamError}</p>
          <button
            type="button"
            onClick={startStream}
            className="shrink-0 text-[12.5px] font-semibold text-red-600 hover:text-red-800 transition-colors"
          >
            {hasPartialResults ? '重试' : '重新改写'}
          </button>
        </div>
      )}

      {/* 结果区 */}
      {hasResults && (
        <div className="flex flex-col gap-3">
          {/* 平台结果 tab */}
          <div className="flex gap-2 flex-wrap">
            {platforms.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => setActiveTab(platform)}
                className={[
                  'px-4 py-1.5 rounded-full text-[12.5px] font-medium transition-all duration-150',
                  activeTab === platform
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white border border-border-default text-text-secondary hover:border-accent/30 hover:bg-accent-muted/50',
                ].join(' ')}
              >
                {PLATFORM_LABELS[platform]}
              </button>
            ))}
          </div>

          {activeTab && (
            <ContentPackage
              body={streamingTexts[activeTab] ?? ''}
              isStreaming={isRewriting && streamingPlatform === activeTab}
              titles={platformPackages[activeTab]?.titles}
              tags={platformPackages[activeTab]?.tags}
              hook={platformPackages[activeTab]?.hook}
              resultId={resultIds[activeTab]}
              onRewrite={startStream}
            />
          )}
        </div>
      )}
    </div>
  )
}
