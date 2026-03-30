// @jest-environment jsdom

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { RewriteWorkspace } from '../rewrite-workspace'
import { useRewriteStore } from '../rewrite-store'

// Mock UrlInput to allow simulating callbacks without real fetch
const mockOnExtracted = jest.fn()
const mockOnError = jest.fn()
jest.mock('../url-input', () => ({
  UrlInput: ({
    onExtracted,
    onError,
    disabled,
  }: {
    onExtracted: (text: string) => void
    onError: (message?: string) => void
    disabled?: boolean
  }) => {
    mockOnExtracted.mockImplementation(onExtracted)
    mockOnError.mockImplementation(onError)
    return (
      <div data-testid="url-input-mock">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onExtracted('模拟提取到的文章正文')}
        >
          模拟提取成功
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onError('无法自动提取该链接的内容，请手动复制文章文本后粘贴')}
        >
          模拟提取失败
        </button>
      </div>
    )
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

// Mock use-rewrite-stream to avoid fetch calls in unit tests
const mockStartStream = jest.fn()
jest.mock('../use-rewrite-stream', () => ({
  useRewriteStream: () => ({ startStream: mockStartStream }),
}))

function resetStore() {
  useRewriteStore.setState({
    text: '',
    platforms: [],
    tone: 'standard',
    status: 'idle',
    streamingTexts: {},
    activeTab: null,
    streamingPlatform: null,
    streamError: null,
  })
}

beforeEach(() => {
  resetStore()
  mockStartStream.mockClear()
  mockOnExtracted.mockClear()
  mockOnError.mockClear()
})

describe('RewriteWorkspace 渲染', () => {
  it('渲染标题和主要输入区域', () => {
    render(<RewriteWorkspace />)
    expect(screen.getByText('改写工作区')).toBeInTheDocument()
    expect(screen.getByLabelText('原文输入框')).toBeInTheDocument()
    expect(screen.getByText('目标平台')).toBeInTheDocument()
    expect(screen.getByText('语气风格')).toBeInTheDocument()
  })

  it('初始状态显示"开始改写"按钮', () => {
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '开始改写' })).toBeInTheDocument()
  })
})

describe('按钮状态随 status 变化', () => {
  it('status=rewriting 时按钮显示"改写中..."', () => {
    useRewriteStore.setState({ status: 'rewriting', platforms: ['xiaohongshu'] })
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '改写中...' })).toBeInTheDocument()
  })

  it('status=complete 时按钮显示"重新改写"', () => {
    useRewriteStore.setState({ status: 'complete', platforms: ['xiaohongshu'] })
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '重新改写' })).toBeInTheDocument()
  })

  it('status=idle 时按钮显示"开始改写"', () => {
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '开始改写' })).toBeInTheDocument()
  })
})

describe('按钮 disabled 状态', () => {
  it('平台未选择时按钮 disabled', () => {
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '开始改写' })).toBeDisabled()
  })

  it('文本有效且有平台时按钮可用', () => {
    // 60 个字符，明确超过 50 字下限
    const validText = 'a'.repeat(60)
    useRewriteStore.setState({ text: validText, platforms: ['xiaohongshu'] })
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '开始改写' })).not.toBeDisabled()
  })

  it('status=rewriting 时按钮 disabled', () => {
    const validText = 'a'.repeat(60)
    useRewriteStore.setState({
      text: validText,
      platforms: ['xiaohongshu'],
      status: 'rewriting',
    })
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '改写中...' })).toBeDisabled()
  })
})

describe('点击改写按钮', () => {
  it('点击"开始改写"调用 startStream', () => {
    const validText = 'a'.repeat(60)
    useRewriteStore.setState({ text: validText, platforms: ['xiaohongshu'] })
    render(<RewriteWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: '开始改写' }))
    expect(mockStartStream).toHaveBeenCalledTimes(1)
  })
})

describe('错误状态', () => {
  it('有 streamError 时显示错误信息', () => {
    useRewriteStore.setState({ streamError: '网络连接失败，请重新改写' })
    render(<RewriteWorkspace />)
    expect(screen.getByText('网络连接失败，请重新改写')).toBeInTheDocument()
  })

  // AC4: 连接失败（无 partial results）→ 按钮文案"重新改写"
  it('无 partial results 时错误横幅显示"重新改写"按钮', () => {
    useRewriteStore.setState({
      streamError: '网络连接失败，请重新改写',
      streamingTexts: {},
    })
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '重新改写' })).toBeInTheDocument()
  })

  // AC1: 有 partial results（mid-stream error）→ 按钮文案"重试"
  it('有 partial results 时错误横幅显示"重试"按钮', () => {
    useRewriteStore.setState({
      streamError: '改写遇到问题，请重试',
      streamingTexts: { xiaohongshu: '已完成的小红书改写内容' },
      platforms: ['xiaohongshu', 'wechat'],
      activeTab: 'xiaohongshu',
    })
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  // AC2: 已完成平台的结果在错误时保留展示
  it('有 partial results 时结果区域仍然展示', () => {
    useRewriteStore.setState({
      streamError: '改写遇到问题，请重试',
      streamingTexts: { xiaohongshu: '小红书已完成内容' },
      platforms: ['xiaohongshu', 'wechat'],
      activeTab: 'xiaohongshu',
    })
    render(<RewriteWorkspace />)
    expect(screen.getByText('小红书已完成内容')).toBeInTheDocument()
  })

  it('点击"重新改写"按钮调用 startStream', () => {
    useRewriteStore.setState({
      streamError: '网络连接失败，请重新改写',
      streamingTexts: {},
    })
    render(<RewriteWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: '重新改写' }))
    expect(mockStartStream).toHaveBeenCalledTimes(1)
  })

  it('点击"重试"按钮调用 startStream', () => {
    useRewriteStore.setState({
      streamError: '改写遇到问题，请重试',
      streamingTexts: { xiaohongshu: '已完成内容' },
      platforms: ['xiaohongshu', 'wechat'],
      activeTab: 'xiaohongshu',
    })
    render(<RewriteWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(mockStartStream).toHaveBeenCalledTimes(1)
  })
})

describe('改写结果展示', () => {
  it('有 streamingTexts 时展示平台 tab', () => {
    useRewriteStore.setState({
      platforms: ['xiaohongshu', 'wechat'],
      streamingTexts: { xiaohongshu: '小红书内容' },
      activeTab: 'xiaohongshu',
    })
    render(<RewriteWorkspace />)
    // 在结果区域的 tab 按钮
    const tabs = screen.getAllByRole('button', { name: '小红书' })
    expect(tabs.length).toBeGreaterThan(0)
  })

  it('activeTab 对应的内容显示在 StreamingText 中', () => {
    useRewriteStore.setState({
      platforms: ['xiaohongshu'],
      streamingTexts: { xiaohongshu: '这是改写后的内容' },
      activeTab: 'xiaohongshu',
    })
    render(<RewriteWorkspace />)
    expect(screen.getByText('这是改写后的内容')).toBeInTheDocument()
  })
})

describe('输入方式 Tab 切换', () => {
  it('默认渲染"粘贴全文" tab active，TextInput 可见，UrlInput 不可见', () => {
    render(<RewriteWorkspace />)
    expect(screen.getByLabelText('原文输入框')).toBeInTheDocument()
    expect(screen.queryByTestId('url-input-mock')).not.toBeInTheDocument()
    // 粘贴全文按钮 active（含 active 样式字符）
    expect(screen.getByRole('button', { name: '粘贴全文' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'URL 提取' })).toBeInTheDocument()
  })

  it('点击"URL 提取" tab → UrlInput 可见，TextInput 不可见', () => {
    render(<RewriteWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: 'URL 提取' }))
    expect(screen.getByTestId('url-input-mock')).toBeInTheDocument()
    expect(screen.queryByLabelText('原文输入框')).not.toBeInTheDocument()
  })

  it('模拟 UrlInput onExtracted → setText 被调用，切回"粘贴全文" tab', async () => {
    render(<RewriteWorkspace />)
    // 切到 URL tab
    fireEvent.click(screen.getByRole('button', { name: 'URL 提取' }))
    expect(screen.getByTestId('url-input-mock')).toBeInTheDocument()

    // 模拟提取成功（点击 mock 按钮）
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '模拟提取成功' }))
    })

    // 应切回粘贴 tab
    expect(screen.getByLabelText('原文输入框')).toBeInTheDocument()
    // setText 应被调用（store 中 text 已更新）
    expect(useRewriteStore.getState().text).toBe('模拟提取到的文章正文')
  })

  it('模拟 UrlInput onError → 切回"粘贴全文" tab', async () => {
    render(<RewriteWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: 'URL 提取' }))
    expect(screen.getByTestId('url-input-mock')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '模拟提取失败' }))
    })

    expect(screen.getByLabelText('原文输入框')).toBeInTheDocument()
  })

  it('模拟 UrlInput onError → 错误提示出现在粘贴 tab 中（AC3 修复验证）', async () => {
    render(<RewriteWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: 'URL 提取' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '模拟提取失败' }))
    })

    // 切回粘贴 tab 后错误提示可见
    expect(screen.getByText('无法自动提取该链接的内容，请手动复制文章文本后粘贴')).toBeInTheDocument()
  })

  it('手动切换 tab 清除错误提示', async () => {
    render(<RewriteWorkspace />)
    fireEvent.click(screen.getByRole('button', { name: 'URL 提取' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '模拟提取失败' }))
    })

    expect(screen.getByText('无法自动提取该链接的内容，请手动复制文章文本后粘贴')).toBeInTheDocument()

    // 切回 URL tab 清除错误
    fireEvent.click(screen.getByRole('button', { name: 'URL 提取' }))
    expect(screen.queryByText('无法自动提取该链接的内容，请手动复制文章文本后粘贴')).not.toBeInTheDocument()
  })

  it('isRewriting 时两个 tab 按钮均禁用', () => {
    useRewriteStore.setState({ status: 'rewriting', platforms: ['xiaohongshu'] })
    render(<RewriteWorkspace />)
    expect(screen.getByRole('button', { name: '粘贴全文' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'URL 提取' })).toBeDisabled()
  })
})
