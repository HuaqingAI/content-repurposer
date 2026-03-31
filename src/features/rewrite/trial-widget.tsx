'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { Platform } from './platform-selector'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'wechat', label: '微信公众号' },
  { value: 'zhihu', label: '知乎' },
]

const MIN_CHARS = 50
const MAX_CHARS = 5000
const PREVIEW_CHARS = 150
const TRIAL_STORAGE_KEY = 'shiwen_trial_prefill'

type TrialStatus = 'idle' | 'streaming' | 'complete' | 'error'

export function TrialWidget() {
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [status, setStatus] = useState<TrialStatus>('idle')
  const [streamingBody, setStreamingBody] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // abort 流当组件卸载
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const charCount = [...text].length
  const canStart =
    charCount >= MIN_CHARS &&
    charCount <= MAX_CHARS &&
    platform !== null &&
    status !== 'streaming'

  async function handleStart() {
    if (!canStart || !platform) return

    // abort 旧流
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setStatus('streaming')
    setStreamingBody('')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, platforms: [platform], tone: 'standard' }),
        signal: controller.signal,
      })

      if (!response.ok) {
        let message = '改写遇到问题，请重试'
        try {
          const body = await response.text()
          const parsed = JSON.parse(body) as { message?: string }
          if (parsed.message) message = parsed.message
        } catch {
          // ignore
        }
        setErrorMessage(message)
        setStatus('error')
        return
      }

      if (!response.body) {
        setErrorMessage('网络连接失败，请重新改写')
        setStatus('error')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let streamDone = false

      while (!streamDone) {
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
            if (line.startsWith('data: '))
              dataStr += (dataStr ? '\n' : '') + line.slice(6).trim()
          }
          if (!eventType || !dataStr) continue

          let data: Record<string, unknown>
          try {
            data = JSON.parse(dataStr) as Record<string, unknown>
          } catch {
            continue
          }

          if (eventType === 'chunk') {
            if (typeof data.text === 'string') {
              setStreamingBody((prev) => prev + data.text)
            }
          } else if (eventType === 'done') {
            setStatus('complete')
            streamDone = true
            break
          } else if (eventType === 'error') {
            const msg =
              typeof data.message === 'string' && data.message
                ? data.message
                : '改写遇到问题，请重试'
            setErrorMessage(msg)
            setStatus('error')
            streamDone = true
            break
          }
        }
      }

      // flush TextDecoder
      const flushed = decoder.decode()
      if (flushed && !streamDone) buffer += flushed

      // 处理末尾残余 buffer
      if (buffer.trim() && !streamDone) {
        let eventType = ''
        let dataStr = ''
        for (const line of buffer.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          if (line.startsWith('data: '))
            dataStr += (dataStr ? '\n' : '') + line.slice(6).trim()
        }
        if (eventType && dataStr) {
          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>
            if (eventType === 'done') {
              setStatus('complete')
            } else if (eventType === 'error') {
              const msg =
                typeof data.message === 'string' && data.message
                  ? data.message
                  : '改写遇到问题，请重试'
              setErrorMessage(msg)
              setStatus('error')
            }
          } catch {
            /* 畸形末尾块忽略 */
          }
        }
      }

      // 流正常关闭但未收到 done 时（用本地变量，避免 stale closure）
      if (!streamDone) {
        setStatus('complete')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setErrorMessage('网络连接失败，请重新改写')
      setStatus('error')
    }
  }

  function handleRegisterClick() {
    if (!platform) return
    try {
      localStorage.setItem(
        TRIAL_STORAGE_KEY,
        JSON.stringify({ text, platform, tone: 'standard' }),
      )
    } catch {
      // ignore localStorage errors
    }
  }

  // 150 汉字截断
  const chars = [...streamingBody]
  const previewText = chars.slice(0, PREVIEW_CHARS).join('')
  const hiddenText = chars.slice(PREVIEW_CHARS).join('')
  const showBlur = status === 'complete' && chars.length > PREVIEW_CHARS
  const showResult = streamingBody.length > 0

  return (
    <div className="w-full flex flex-col gap-0">
      {/* 输入区 */}
      <div className="flex flex-col gap-0 px-5 pt-5">
        <textarea
          className="w-full min-h-[148px] rounded-xl border border-border-default bg-paper px-4 py-3.5 text-[13.5px] text-ink resize-none focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent/40 transition-all duration-150 placeholder:text-text-caption leading-relaxed"
          placeholder={`粘贴原文（${MIN_CHARS}–${MAX_CHARS} 字）`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={status === 'streaming'}
          maxLength={MAX_CHARS + 200}
          aria-label="试用文本输入框"
        />
        <span
          className={[
            'text-[11px] text-right mt-1.5 tabular-nums transition-colors duration-150',
            charCount > MAX_CHARS
              ? 'text-red-500'
              : charCount >= MIN_CHARS
                ? 'text-accent/60'
                : 'text-text-caption',
          ].join(' ')}
        >
          {charCount} / {MAX_CHARS}
        </span>
      </div>

      {/* 平台选择 + 提交按钮 */}
      <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
        {/* 平台 chips */}
        <div className="flex gap-2 flex-wrap">
          {PLATFORMS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlatform(value)}
              disabled={status === 'streaming'}
              className={[
                'px-4 py-1.5 rounded-full border text-[12.5px] font-medium transition-all duration-150',
                platform === value
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-transparent border-border-default text-text-secondary hover:border-accent/35 hover:bg-accent-muted/60',
                status === 'streaming' ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 提交按钮 */}
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="w-full py-3 rounded-full font-semibold text-[13px] transition-all duration-150 tracking-wide disabled:opacity-35 disabled:cursor-not-allowed bg-accent text-white hover:bg-accent-hover active:scale-[0.98] shadow-[0_1px_8px_rgba(61,107,79,0.2)] hover:shadow-[0_2px_14px_rgba(61,107,79,0.3)]"
        >
          {status === 'streaming' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:240ms]" />
              </span>
              改写中
            </span>
          ) : (
            '免费试用'
          )}
        </button>
      </div>

      {/* 错误提示 */}
      {status === 'error' && errorMessage && (
        <div className="mx-5 mb-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-100">
          <p className="text-[12.5px] text-red-600 text-center">{errorMessage}</p>
        </div>
      )}

      {/* 结果区 */}
      {showResult && (
        <div className="relative mx-5 mb-5 rounded-xl border border-border-default bg-white overflow-hidden">
          {/* 结果头 */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-default bg-paper/60">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/50" />
            <span className="text-[11px] text-text-caption tracking-wide uppercase">
              改写结果
            </span>
            {status === 'streaming' && (
              <span className="ml-auto text-[11px] text-accent/60 animate-pulse">生成中…</span>
            )}
          </div>

          <div className="px-4 py-4">
            <p className="whitespace-pre-wrap text-[13.5px] text-ink/80 leading-[1.85]">
              {previewText}
              {hiddenText && (
                <span className={status === 'complete' ? 'blur-sm select-none' : ''}>
                  {hiddenText}
                </span>
              )}
            </p>
          </div>

          {showBlur && (
            <>
              {/* 渐变遮罩 */}
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
              {/* 解锁 CTA */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 pb-5">
                <p className="text-[12.5px] font-medium text-ink/70">注册免费解锁完整内容</p>
                <Link
                  href="/login"
                  onClick={handleRegisterClick}
                  className="inline-flex items-center gap-1.5 px-6 py-2 rounded-full bg-accent text-white font-semibold text-[12.5px] hover:bg-accent-hover transition-all duration-200 shadow-sm"
                >
                  免费注册
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
