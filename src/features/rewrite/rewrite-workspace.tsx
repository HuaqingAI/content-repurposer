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
    // AC3：切回粘贴 tab 后聚焦 textarea，引导手动粘贴
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

    // 若没有 searchParams 文本，检查 trial 预填
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
  // 有部分平台已完成（mid-stream error）→ 按钮显示"重试"；连接失败无结果 → "重新改写"
  const hasPartialResults =
    streamError !== null && Object.keys(streamingTexts).length > 0

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-5">
      <h1 className="text-lg font-semibold text-gray-800">改写工作区</h1>
      {/* 输入方式 tab */}
      <div className="flex border border-border-default rounded-md overflow-hidden mb-0">
        {(['paste', 'url'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            disabled={isRewriting}
            onClick={() => { setInputTab(tab); setUrlExtractError(null) }}
            className={[
              'flex-1 py-1.5 text-center text-xs font-medium transition-all duration-150',
              inputTab === tab
                ? 'bg-white text-gray-800 font-semibold shadow-[inset_0_-2px_0_var(--color-accent)]'
                : 'bg-surface-2 text-text-secondary',
              isRewriting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            {tab === 'paste' ? '粘贴全文' : 'URL 提取'}
          </button>
        ))}
      </div>

      {inputTab === 'paste' ? (
        <>
          <TextInput value={text} onChange={setText} disabled={isRewriting} />
          {urlExtractError && (
            <p className="text-xs text-red-500 -mt-3">{urlExtractError}</p>
          )}
        </>
      ) : (
        <UrlInput
          onExtracted={handleUrlExtracted}
          onError={handleUrlError}
          disabled={isRewriting}
        />
      )}
      <PlatformSelector value={platforms} onChange={setPlatforms} disabled={isRewriting} />
      <ToneSelector value={tone} onChange={setTone} disabled={isRewriting} />

      <button
        type="button"
        disabled={isDisabled}
        onClick={startStream}
        className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
      >
        {isRewriting ? '改写中...' : isDone ? '重新改写' : '开始改写'}
      </button>

      {streamError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="flex-1 text-sm text-red-700">{streamError}</p>
          <button
            type="button"
            onClick={startStream}
            className="shrink-0 text-sm font-medium text-red-700 underline hover:no-underline"
          >
            {hasPartialResults ? '重试' : '重新改写'}
          </button>
        </div>
      )}

      {hasResults && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            {platforms.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => setActiveTab(platform)}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150',
                  activeTab === platform
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-text-secondary hover:bg-accent-light border border-border-default',
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
