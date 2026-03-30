import { useEffect, useRef } from 'react'
import type { Platform } from './platform-selector'
import { useRewriteStore } from './rewrite-store'

const VALID_PLATFORMS: Platform[] = ['xiaohongshu', 'wechat', 'zhihu']

export function useRewriteStream() {
  const startRewrite = useRewriteStore((s) => s.startRewrite)
  const onPlatformStart = useRewriteStore((s) => s.onPlatformStart)
  const appendChunk = useRewriteStore((s) => s.appendChunk)
  const setStreamError = useRewriteStore((s) => s.setStreamError)
  const completeRewrite = useRewriteStore((s) => s.completeRewrite)
  const setTitles = useRewriteStore((s) => s.setTitles)
  const setTags = useRewriteStore((s) => s.setTags)
  const setHook = useRewriteStore((s) => s.setHook)
  const setRecordId = useRewriteStore((s) => s.setRecordId)
  const setResultId = useRewriteStore((s) => s.setResultId)

  const abortControllerRef = useRef<AbortController | null>(null)

  // 组件卸载时 abort 当前活跃的流
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  async function startStream() {
    // 并发保护：改写进行中不允许重复触发
    if (useRewriteStore.getState().status === 'rewriting') return

    // abort 旧流（重试 / 重新改写场景），再建新控制器
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    startRewrite() // status → rewriting；清空 streamingTexts / streamError

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    try {
      const { text, platforms, tone } = useRewriteStore.getState()

      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, platforms, tone }),
        signal: controller.signal,
      })

      // HTTP 非 2xx：统一用户友好文案，不暴露状态码
      if (!response.ok) {
        response.body?.cancel()
        setStreamError('网络连接失败，请重新改写')
        return
      }
      if (!response.body) {
        setStreamError('网络连接失败，请重新改写')
        return
      }

      reader = response.body.getReader()
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
            // 按 SSE spec 累加多行 data
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

          if (eventType === 'platform_start') {
            // 运行时类型校验 + 校验是否属于用户所选平台
            const selectedPlatforms = useRewriteStore.getState().platforms
            if (
              typeof data.platform === 'string' &&
              VALID_PLATFORMS.includes(data.platform as Platform) &&
              selectedPlatforms.includes(data.platform as Platform)
            ) {
              onPlatformStart(data.platform as Platform)
            }
          } else if (eventType === 'chunk') {
            // 使用 getState() 避免 React 闭包陈旧值
            const currentPlatform = useRewriteStore.getState().streamingPlatform
            if (currentPlatform && typeof data.text === 'string') {
              appendChunk(currentPlatform, data.text)
            }
          } else if (eventType === 'titles') {
            const currentPlatform = useRewriteStore.getState().streamingPlatform
            if (currentPlatform && Array.isArray(data.titles)) {
              setTitles(currentPlatform, data.titles as string[])
            }
          } else if (eventType === 'tags') {
            const currentPlatform = useRewriteStore.getState().streamingPlatform
            if (currentPlatform && Array.isArray(data.tags)) {
              setTags(currentPlatform, data.tags as string[])
            }
          } else if (eventType === 'hook') {
            const currentPlatform = useRewriteStore.getState().streamingPlatform
            if (currentPlatform && typeof data.hook === 'string') {
              setHook(currentPlatform, data.hook)
            }
          } else if (eventType === 'platform_complete') {
            const selectedPlatforms = useRewriteStore.getState().platforms
            if (
              typeof data.platform === 'string' &&
              VALID_PLATFORMS.includes(data.platform as Platform) &&
              selectedPlatforms.includes(data.platform as Platform) &&
              typeof data.result_id === 'string'
            ) {
              setResultId(data.platform as Platform, data.result_id)
            }
          } else if (eventType === 'done') {
            if (typeof data.record_id === 'string') {
              setRecordId(data.record_id)
            }
            completeRewrite()
            streamDone = true
            break
          } else if (eventType === 'error') {
            // retryable: true（默认）→ 固定文案；retryable: false → 使用 SSE message（用户友好）
            const retryable = data.retryable !== false
            const message = retryable
              ? '改写遇到问题，请重试'
              : typeof data.message === 'string'
                ? data.message
                : '改写遇到问题，请重试'
            setStreamError(message)
            streamDone = true
            break
          }
        }
      }

      // flush TextDecoder，防止末尾多字节字符截断
      const flushed = decoder.decode()
      if (flushed && !streamDone) buffer += flushed

      // 处理流关闭后 buffer 中剩余的最后一个事件块
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
              if (typeof data.record_id === 'string') {
                setRecordId(data.record_id)
              }
              completeRewrite()
            } else if (eventType === 'error') {
              const retryable = data.retryable !== false
              const message = retryable
                ? '改写遇到问题，请重试'
                : typeof data.message === 'string'
                  ? data.message
                  : '改写遇到问题，请重试'
              setStreamError(message)
            }
          } catch {
            /* 畸形末尾块忽略 */
          }
        }
      }

      // 流正常关闭但未收到 done 事件时，确保 status 不永久卡在 rewriting
      if (useRewriteStore.getState().status === 'rewriting') {
        completeRewrite()
      }
    } catch (err) {
      // AbortError：用户主动中止（重试 / 组件卸载），释放流锁后静默退出
      if (err instanceof DOMException && err.name === 'AbortError') {
        reader?.cancel()
        return
      }

      // 网络异常 / 其他错误：统一用户友好文案，不暴露 err.message
      setStreamError('网络连接失败，请重新改写')
    }
  }

  return { startStream }
}
