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
  const canStart = charCount >= MIN_CHARS && charCount <= MAX_CHARS && platform !== null && status !== 'streaming'

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
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {/* 文本输入 */}
      <div className="flex flex-col gap-1">
        <textarea
          className="w-full min-h-[140px] rounded-xl border border-border-default bg-surface-2 px-4 py-3 text-sm text-text-primary resize-none focus:outline-none focus:border-accent transition-colors"
          placeholder={`粘贴原文（${MIN_CHARS}–${MAX_CHARS} 字）`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={status === 'streaming'}
          maxLength={MAX_CHARS + 200}
          aria-label="试用文本输入框"
        />
        <span className="text-xs text-text-secondary text-right">
          {charCount} / {MAX_CHARS}
        </span>
      </div>

      {/* 平台单选 */}
      <div className="flex gap-2 flex-wrap">
        {PLATFORMS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPlatform(value)}
            disabled={status === 'streaming'}
            className={[
              'px-4 py-2 rounded-lg border text-sm transition-colors duration-150',
              platform === value
                ? 'bg-accent-light border-accent text-accent font-medium'
                : 'bg-surface-2 border-border-default text-text-secondary hover:border-border-focus',
              status === 'streaming' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 开始按钮 */}
      <button
        type="button"
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-3 rounded-xl bg-accent text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
      >
        {status === 'streaming' ? '改写中...' : '免费试用'}
      </button>

      {/* 错误提示 */}
      {status === 'error' && errorMessage && (
        <p className="text-sm text-red-600 text-center">{errorMessage}</p>
      )}

      {/* 结果区域 */}
      {showResult && (
        <div className="relative rounded-xl border border-border-default bg-white p-4 overflow-hidden">
          <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
            {previewText}
            {hiddenText && (
              <span className={status === 'complete' ? 'blur-sm select-none' : ''}>{hiddenText}</span>
            )}
          </p>
          {showBlur && (
            <>
              {/* 渐变遮罩 */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              {/* CTA */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-4">
                <p className="text-sm font-medium text-gray-800">注册免费解锁完整内容</p>
                <Link
                  href="/login"
                  onClick={handleRegisterClick}
                  className="px-6 py-2 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-colors"
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
