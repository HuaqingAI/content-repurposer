// @jest-environment jsdom

import { TextEncoder, TextDecoder } from 'util'
// Make Node.js encoding APIs available in jsdom test environment
global.TextEncoder = TextEncoder as typeof global.TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder
// jsdom 不内置 fetch，初始化占位使 jest.spyOn 可正常工作
global.fetch = jest.fn() as jest.Mock

import { renderHook, act, waitFor } from '@testing-library/react'
import { useRewriteStream } from '../use-rewrite-stream'
import { useRewriteStore } from '../rewrite-store'

// ──────────────────────────────────────────────────────────────────────────────
// 辅助工具
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 构造一个 mock Response，body 是自定义的 ReadableStreamDefaultReader mock。
 * 避免依赖 jsdom / Node stream/web 兼容性问题。
 */
function buildSSEResponse(events: string, ok = true, status = 200): Response {
  const encoder = new TextEncoder()
  const chunk = encoder.encode(events)
  let called = false

  const mockReader = {
    read: jest.fn().mockImplementation(() => {
      if (!called) {
        called = true
        return Promise.resolve({ done: false, value: chunk })
      }
      return Promise.resolve({ done: true, value: undefined })
    }),
    cancel: jest.fn(),
    releaseLock: jest.fn(),
  }

  const mockBody = {
    getReader: () => mockReader,
  }

  return {
    ok,
    status,
    body: mockBody,
  } as unknown as Response
}

function mockFetch(response: Response) {
  jest.spyOn(global, 'fetch').mockResolvedValue(response)
}

function mockFetchReject(error: unknown) {
  jest.spyOn(global, 'fetch').mockRejectedValue(error)
}

function resetStore() {
  useRewriteStore.setState({
    text: '测试原文内容至少五十个字符以满足最低字数要求哈哈哈哈哈哈哈哈哈哈',
    platforms: ['xiaohongshu'],
    tone: 'standard',
    status: 'idle',
    streamingTexts: {},
    activeTab: null,
    streamingPlatform: null,
    streamError: null,
    platformPackages: {},
    recordId: null,
  })
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ──────────────────────────────────────────────────────────────────────────────
// SSE error 事件：retryable: true → 固定文案
// ──────────────────────────────────────────────────────────────────────────────

describe('SSE error 事件处理', () => {
  it('retryable: true → store 收到固定文案"改写遇到问题，请重试"', async () => {
    const ssePayload =
      'event: error\ndata: {"message":"LLM timeout","retryable":true}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().streamError).toBe('改写遇到问题，请重试')
    })
  })

  it('retryable: false → store 收到 SSE message 原文', async () => {
    const ssePayload =
      'event: error\ndata: {"message":"该内容暂不支持改写，请尝试其他类型的文章","retryable":false}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().streamError).toBe(
        '该内容暂不支持改写，请尝试其他类型的文章',
      )
    })
  })

  it('error 事件后 status 恢复为 idle', async () => {
    const ssePayload =
      'event: error\ndata: {"message":"err","retryable":true}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().status).toBe('idle')
    })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// HTTP 非 2xx → 用户友好文案
// ──────────────────────────────────────────────────────────────────────────────

describe('HTTP 错误处理', () => {
  it('HTTP 非 2xx → store 收到"网络连接失败，请重新改写"', async () => {
    mockFetch(buildSSEResponse('', false, 500))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().streamError).toBe(
        '网络连接失败，请重新改写',
      )
    })
  })

  it('fetch throw（网络异常）→ store 收到"网络连接失败，请重新改写"', async () => {
    mockFetchReject(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().streamError).toBe(
        '网络连接失败，请重新改写',
      )
    })
  })

  it('HTTP 错误不暴露技术性状态码文案', async () => {
    mockFetch(buildSSEResponse('', false, 503))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      const err = useRewriteStore.getState().streamError ?? ''
      expect(err).not.toMatch(/503/)
      expect(err).not.toMatch(/HTTP/)
    })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// AbortError → 静默退出，不设 streamError
// ──────────────────────────────────────────────────────────────────────────────

describe('AbortError 处理', () => {
  it('AbortError 不设置 streamError（静默退出）', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError')
    mockFetchReject(abortErr)

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().streamError).toBeNull()
    })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 核心流式路径：platform_start → chunk → done
// ──────────────────────────────────────────────────────────────────────────────

describe('核心流式路径', () => {
  it('platform_start + chunk + done 序列正确累积文本并完成', async () => {
    const ssePayload =
      'event: platform_start\ndata: {"platform":"xiaohongshu"}\n\n' +
      'event: chunk\ndata: {"text":"第一段"}\n\n' +
      'event: chunk\ndata: {"text":"第二段"}\n\n' +
      'event: done\ndata: {"record_id":"abc"}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().status).toBe('complete')
    })

    const streamingTexts = useRewriteStore.getState().streamingTexts
    expect(streamingTexts['xiaohongshu']).toBe('第一段第二段')
    expect(useRewriteStore.getState().streamError).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// done 事件 → completeRewrite 且 break
// ──────────────────────────────────────────────────────────────────────────────

describe('done 事件', () => {
  it('done 事件后 status 变为 complete', async () => {
    const ssePayload = 'event: done\ndata: {"record_id":"abc"}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().status).toBe('complete')
    })
  })

  it('done 事件后不设置 streamError', async () => {
    const ssePayload = 'event: done\ndata: {"record_id":"abc"}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().streamError).toBeNull()
    })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 并发保护：status=rewriting 时 startStream 直接返回
// ──────────────────────────────────────────────────────────────────────────────

describe('并发保护', () => {
  it('status=rewriting 时再次调用 startStream 不发起新请求', async () => {
    useRewriteStore.setState({ status: 'rewriting' })
    const fetchMock = jest.fn().mockResolvedValue(
      buildSSEResponse('event: done\ndata: {}\n\n'),
    )
    global.fetch = fetchMock

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 请求体携带正确的 text / platforms / tone
// ──────────────────────────────────────────────────────────────────────────────

describe('请求体构建', () => {
  it('fetch 发送正确的 JSON body', async () => {
    // 文本需满足 50 字符最低限，此处使用恰好 50 个字符的字符串
    const bodyText = '这是测试原文内容至少五十个字符以满足最低字数要求哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈'
    useRewriteStore.setState({
      text: bodyText,
      platforms: ['wechat', 'zhihu'],
      tone: 'formal',
      status: 'idle',
    })

    const fetchMock = jest
      .fn()
      .mockResolvedValue(buildSSEResponse('event: done\ndata: {}\n\n'))
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock)

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rewrite',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          text: bodyText,
          platforms: ['wechat', 'zhihu'],
          tone: 'formal',
        }),
      }),
    )
  })

  it('fetch 调用 /api/rewrite 端点（非 mock 端点）', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(buildSSEResponse('event: done\ndata: {}\n\n'))
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock)

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    const calledUrl = (fetchMock.mock.calls[0] as [string, ...unknown[]])[0]
    expect(calledUrl).toBe('/api/rewrite')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 新增 SSE 事件：titles / tags / hook / record_id
// ──────────────────────────────────────────────────────────────────────────────

describe('新增 SSE 事件：titles / tags / hook / record_id', () => {
  it('收到 titles 事件时，setTitles 写入对应平台', async () => {
    const ssePayload =
      'event: platform_start\ndata: {"platform":"xiaohongshu"}\n\n' +
      'event: titles\ndata: {"titles":["标题1","标题2","标题3"]}\n\n' +
      'event: done\ndata: {"record_id":"r1"}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().status).toBe('complete')
    })

    expect(useRewriteStore.getState().platformPackages['xiaohongshu']?.titles).toEqual([
      '标题1',
      '标题2',
      '标题3',
    ])
  })

  it('收到 tags 事件时，setTags 写入对应平台', async () => {
    const ssePayload =
      'event: platform_start\ndata: {"platform":"xiaohongshu"}\n\n' +
      'event: tags\ndata: {"tags":["标签A","标签B"]}\n\n' +
      'event: done\ndata: {"record_id":"r2"}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().status).toBe('complete')
    })

    expect(useRewriteStore.getState().platformPackages['xiaohongshu']?.tags).toEqual([
      '标签A',
      '标签B',
    ])
  })

  it('收到 hook 事件时，setHook 写入对应平台', async () => {
    const ssePayload =
      'event: platform_start\ndata: {"platform":"xiaohongshu"}\n\n' +
      'event: hook\ndata: {"hook":"欢迎在评论区分享你的想法！"}\n\n' +
      'event: done\ndata: {"record_id":"r3"}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().status).toBe('complete')
    })

    expect(useRewriteStore.getState().platformPackages['xiaohongshu']?.hook).toBe(
      '欢迎在评论区分享你的想法！',
    )
  })

  it('done 事件携带 record_id 时，recordId 被写入 store', async () => {
    const ssePayload = 'event: done\ndata: {"record_id":"uuid-abc-123"}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().status).toBe('complete')
    })

    expect(useRewriteStore.getState().recordId).toBe('uuid-abc-123')
  })

  it('titles / tags / hook 均到达后，platformPackages 字段互不覆盖', async () => {
    const ssePayload =
      'event: platform_start\ndata: {"platform":"xiaohongshu"}\n\n' +
      'event: titles\ndata: {"titles":["标题1","标题2","标题3"]}\n\n' +
      'event: tags\ndata: {"tags":["标签A"]}\n\n' +
      'event: hook\ndata: {"hook":"引导语内容"}\n\n' +
      'event: done\ndata: {"record_id":"r4"}\n\n'
    mockFetch(buildSSEResponse(ssePayload))

    const { result } = renderHook(() => useRewriteStream())

    await act(async () => {
      await result.current.startStream()
    })

    await waitFor(() => {
      expect(useRewriteStore.getState().status).toBe('complete')
    })

    const pkg = useRewriteStore.getState().platformPackages['xiaohongshu']
    expect(pkg?.titles).toEqual(['标题1', '标题2', '标题3'])
    expect(pkg?.tags).toEqual(['标签A'])
    expect(pkg?.hook).toBe('引导语内容')
  })
})
