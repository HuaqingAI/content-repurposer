'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TextInput } from '@/features/rewrite/text-input'
import { PlatformSelector, type Platform } from '@/features/rewrite/platform-selector'
import { ToneSelector, type Tone } from '@/features/rewrite/tone-selector'
import { StreamingText } from '@/features/rewrite/streaming-text'

const VALID_PLATFORMS: Platform[] = ['xiaohongshu', 'wechat', 'zhihu']
const VALID_TONES: Tone[] = ['casual', 'standard', 'formal']

const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}

function AppPageContent() {
  const searchParams = useSearchParams()

  const [text, setText] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [tone, setTone] = useState<Tone>('standard')

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingTexts, setStreamingTexts] = useState<Partial<Record<Platform, string>>>({})
  const [activeTab, setActiveTab] = useState<Platform | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  // ref 用来在 chunk 事件处理器中读取最新的 activeTab，避免闭包陈旧值
  const activeTabRef = useRef<Platform | null>(null)

  const setActivePlatform = (p: Platform) => {
    activeTabRef.current = p
    setActiveTab(p)
  }

  // 从 URL searchParams 预填（历史记录复用）
  useEffect(() => {
    const rawText = searchParams.get('text')
    if (rawText) {
      // 截断到 5000 字（Unicode 安全）
      setText([...rawText].slice(0, 5000).join(''))
    }

    const rawPlatforms = searchParams.get('platforms')
    if (rawPlatforms) {
      const validPlatforms = rawPlatforms
        .split(',')
        .filter((p) => VALID_PLATFORMS.includes(p as Platform)) as Platform[]
      if (validPlatforms.length > 0) setPlatforms(validPlatforms)
    }

    const rawTone = searchParams.get('tone')
    if (rawTone && VALID_TONES.includes(rawTone as Tone)) {
      setTone(rawTone as Tone)
    }
  }, [searchParams])

  const charCount = useMemo(() => [...text].length, [text])
  const isTextValid = charCount >= 50 && charCount <= 5000
  const isDisabled = !isTextValid || platforms.length === 0 || isStreaming

  const hasResults = Object.keys(streamingTexts).length > 0 || isStreaming

  async function startRewrite() {
    setIsStreaming(true)
    setStreamError(null)
    setStreamingTexts({})
    setActiveTab(null)
    setIsDone(false)
    activeTabRef.current = null

    try {
      const response = await fetch('/api/mock-rewrite', { method: 'POST' })
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue
          let eventType = ''
          let dataStr = ''
          for (const line of eventBlock.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            if (line.startsWith('data: ')) dataStr = line.slice(6).trim()
          }
          if (!eventType || !dataStr) continue

          let data: Record<string, unknown>
          try {
            data = JSON.parse(dataStr) as Record<string, unknown>
          } catch {
            continue
          }

          if (eventType === 'platform_start') {
            setActivePlatform(data.platform as Platform)
          } else if (eventType === 'chunk') {
            const currentPlatform = activeTabRef.current
            if (currentPlatform) {
              setStreamingTexts(prev => ({
                ...prev,
                [currentPlatform]: ((prev[currentPlatform] ?? '') + (data.text as string)),
              }))
            }
          } else if (eventType === 'done') {
            setIsStreaming(false)
            setIsDone(true)
          } else if (eventType === 'error') {
            setStreamError(data.message as string)
            setIsStreaming(false)
          }
        }
      }
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : '网络错误，请重试')
      setIsStreaming(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-5">
      <h1 className="text-lg font-semibold text-gray-800">改写工作区</h1>
      <TextInput value={text} onChange={setText} disabled={isStreaming} />
      <PlatformSelector value={platforms} onChange={setPlatforms} disabled={isStreaming} />
      <ToneSelector value={tone} onChange={setTone} disabled={isStreaming} />

      <button
        type="button"
        disabled={isDisabled}
        onClick={startRewrite}
        className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
      >
        {isStreaming ? '改写中...' : isDone ? '重新改写' : '开始改写'}
      </button>

      {/* 错误提示 */}
      {streamError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="flex-1 text-sm text-red-700">{streamError}</p>
          <button
            type="button"
            onClick={startRewrite}
            className="shrink-0 text-sm font-medium text-red-700 underline hover:no-underline"
          >
            重试
          </button>
        </div>
      )}

      {/* 结果区域 */}
      {hasResults && !streamError && (
        <div className="flex flex-col gap-3">
          {/* 平台 Tab 栏 */}
          <div className="flex gap-2 flex-wrap">
            {platforms.map(platform => (
              <button
                key={platform}
                type="button"
                onClick={() => setActivePlatform(platform)}
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

          {/* 当前 Tab 内容 */}
          {activeTab && (
            <StreamingText
              text={streamingTexts[activeTab] ?? ''}
              isStreaming={isStreaming && activeTabRef.current === activeTab}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Suspense 包裹：Next.js 中 useSearchParams() 需要 Suspense boundary
export default function AppPage() {
  return (
    <Suspense>
      <AppPageContent />
    </Suspense>
  )
}
