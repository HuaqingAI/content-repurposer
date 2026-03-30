// @jest-environment jsdom

// Polyfill TextDecoder/TextEncoder which are missing in this jsdom environment
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util'
if (typeof global.TextDecoder === 'undefined') {
  Object.defineProperty(global, 'TextDecoder', { value: NodeTextDecoder, writable: true })
}
if (typeof global.TextEncoder === 'undefined') {
  Object.defineProperty(global, 'TextEncoder', { value: NodeTextEncoder, writable: true })
}

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { TrialWidget } from '../trial-widget'

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

// Helper: create a mock body with a reader that emits SSE chunks
function createMockBody(events: string[]) {
  const enc = new TextEncoder()
  const chunks = events.map((e) => enc.encode(e))
  let index = 0
  const reader = {
    read: jest.fn(async () => {
      if (index < chunks.length) {
        return { done: false, value: chunks[index++] }
      }
      return { done: true, value: undefined }
    }),
    cancel: jest.fn(),
  }
  return { getReader: () => reader }
}

function mockFetchOk(sseEvents: string[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: createMockBody(sseEvents),
  })
}

function mockFetch429(message: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({ message }),
    body: null,
    text: async () => JSON.stringify({ message }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  // Reset localStorage
  localStorage.clear()
})

describe('TrialWidget — 按钮禁用逻辑', () => {
  it('字数 < 50 时"免费试用"按钮禁用', () => {
    render(<TrialWidget />)
    const btn = screen.getByRole('button', { name: '免费试用' })
    expect(btn).toBeDisabled()
  })

  it('字数 >= 50 但未选平台时"免费试用"按钮禁用', () => {
    render(<TrialWidget />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '字'.repeat(50) } })
    expect(screen.getByRole('button', { name: '免费试用' })).toBeDisabled()
  })

  it('选择平台且字数 >= 50 后按钮可用', () => {
    render(<TrialWidget />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '字'.repeat(50) } })
    fireEvent.click(screen.getByRole('button', { name: '小红书' }))
    expect(screen.getByRole('button', { name: '免费试用' })).not.toBeDisabled()
  })
})

describe('TrialWidget — 点击试用触发改写', () => {
  it('选择平台后点击"免费试用"触发 fetch("/api/rewrite")', async () => {
    mockFetchOk([
      'event: chunk\ndata: {"text":"Hello"}\n\n',
      'event: done\ndata: {"trial":true,"record_id":null}\n\n',
    ])
    render(<TrialWidget />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '字'.repeat(50) } })
    fireEvent.click(screen.getByRole('button', { name: '小红书' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '免费试用' }))
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/rewrite',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"platforms":["xiaohongshu"]'),
      }),
    )
  })
})

describe('TrialWidget — SSE 流式文本追加', () => {
  it('模拟 SSE chunk 事件 → 文本逐渐追加到结果区域', async () => {
    mockFetchOk([
      'event: chunk\ndata: {"text":"hello "}\n\n',
      'event: chunk\ndata: {"text":"world"}\n\n',
      'event: done\ndata: {"trial":true,"record_id":null}\n\n',
    ])
    render(<TrialWidget />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '字'.repeat(50) } })
    fireEvent.click(screen.getByRole('button', { name: '微信公众号' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '免费试用' }))
    })

    await waitFor(() => {
      expect(screen.getByText(/hello/)).toBeInTheDocument()
    })
  })
})

describe('TrialWidget — done 事件展示模糊遮罩', () => {
  it('改写完成 done 后超 150 字内容展示模糊遮罩和注册 CTA', async () => {
    // Use 200 ASCII chars to exceed the 150-char preview threshold
    const longText = 'a'.repeat(200)
    mockFetchOk([
      `event: chunk\ndata: {"text":"${longText}"}\n\n`,
      'event: done\ndata: {"trial":true,"record_id":null}\n\n',
    ])
    render(<TrialWidget />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '字'.repeat(50) } })
    fireEvent.click(screen.getByRole('button', { name: '知乎' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '免费试用' }))
    })

    await waitFor(() => {
      expect(screen.getByText('注册免费解锁完整内容')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '免费注册' })).toBeInTheDocument()
    })
  })

  it('done 后"免费注册"按钮点击将 trial 数据存入 localStorage 并跳转 /login', async () => {
    const longText = 'a'.repeat(200)
    mockFetchOk([
      `event: chunk\ndata: {"text":"${longText}"}\n\n`,
      'event: done\ndata: {"trial":true,"record_id":null}\n\n',
    ])
    render(<TrialWidget />)
    const inputText = '字'.repeat(50)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: inputText } })
    fireEvent.click(screen.getByRole('button', { name: '小红书' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '免费试用' }))
    })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '免费注册' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('link', { name: '免费注册' }))
    const stored = localStorage.getItem('shiwen_trial_prefill')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.platform).toBe('xiaohongshu')
    expect(parsed.tone).toBe('standard')
  })
})

describe('TrialWidget — 429 限流提示', () => {
  it('模拟 429 响应 → 展示限流友好提示', async () => {
    mockFetch429('今日试用次数已达上限，注册后可免费无限使用')
    render(<TrialWidget />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '字'.repeat(50) } })
    fireEvent.click(screen.getByRole('button', { name: '小红书' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '免费试用' }))
    })

    await waitFor(() => {
      expect(screen.getByText(/今日试用次数已达上限/)).toBeInTheDocument()
    })
  })
})
