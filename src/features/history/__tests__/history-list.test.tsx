// @jest-environment jsdom

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HistoryList } from '../history-list'
import type { HistoryRecordSummary } from '../types'

// 屏蔽 next/link 简化测试
jest.mock('next/link', () => {
  return function Link({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

// 屏蔽 next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// 屏蔽 fetch（加载更多）
global.fetch = jest.fn()

const makeRecord = (overrides: Partial<HistoryRecordSummary> = {}): HistoryRecordSummary => ({
  id: 'rec-1',
  originalText: '这是一段测试内容，用于测试历史记录卡片的显示效果',
  contentType: 'opinion',
  createdAt: new Date('2026-03-27T10:00:00Z').toISOString(),
  results: [{ id: 'res-1', platform: 'xiaohongshu' }],
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  // 默认 fetch 返回 ok:false（触发 modal 的错误路径，避免 undefined.then() 崩溃）
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ data: null, error: { code: 'NOT_FOUND', message: '记录不存在' } }),
  })
})

describe('HistoryList', () => {
  it('无记录时显示空状态提示', () => {
    render(<HistoryList initialRecords={[]} initialTotal={0} pageSize={20} />)
    expect(screen.getByText('还没有改写记录，去改写第一篇吧')).toBeInTheDocument()
  })

  it('无记录时显示跳转到改写页的链接', () => {
    render(<HistoryList initialRecords={[]} initialTotal={0} pageSize={20} />)
    const link = screen.getByRole('link', { name: '开始改写' })
    expect(link).toHaveAttribute('href', '/app')
  })

  it('有记录时渲染记录卡片', () => {
    const records = [
      makeRecord({ id: 'rec-1', originalText: '第一条记录内容' }),
      makeRecord({ id: 'rec-2', originalText: '第二条记录内容' }),
    ]
    render(<HistoryList initialRecords={records} initialTotal={2} pageSize={20} />)
    expect(screen.getByText('第一条记录内容')).toBeInTheDocument()
    expect(screen.getByText('第二条记录内容')).toBeInTheDocument()
  })

  it('有更多记录时显示"加载更多"按钮', () => {
    const records = [makeRecord()]
    render(<HistoryList initialRecords={records} initialTotal={25} pageSize={20} />)
    expect(screen.getByRole('button', { name: /加载更多/ })).toBeInTheDocument()
  })

  it('全部加载完毕时不显示"加载更多"按钮', () => {
    const records = [makeRecord()]
    render(<HistoryList initialRecords={records} initialTotal={1} pageSize={20} />)
    expect(screen.queryByRole('button', { name: /加载更多/ })).not.toBeInTheDocument()
  })

  it('点击卡片后不立即崩溃（弹窗可以打开）', () => {
    const record = makeRecord()
    render(<HistoryList initialRecords={[record]} initialTotal={1} pageSize={20} />)
    const card = screen.getByRole('button', { name: /这是一段测试内容/ })
    expect(() => fireEvent.click(card)).not.toThrow()
  })

  it('平台标签正确显示中文名', () => {
    const record = makeRecord({ results: [{ id: 'r1', platform: 'xiaohongshu' }] })
    render(<HistoryList initialRecords={[record]} initialTotal={1} pageSize={20} />)
    expect(screen.getByText('小红书')).toBeInTheDocument()
  })

  it('多平台标签均正确展示', () => {
    const record = makeRecord({
      results: [
        { id: 'r1', platform: 'xiaohongshu' },
        { id: 'r2', platform: 'wechat' },
        { id: 'r3', platform: 'zhihu' },
      ],
    })
    render(<HistoryList initialRecords={[record]} initialTotal={1} pageSize={20} />)
    expect(screen.getByText('小红书')).toBeInTheDocument()
    expect(screen.getByText('微信公众号')).toBeInTheDocument()
    expect(screen.getByText('知乎')).toBeInTheDocument()
  })

  it('加载更多成功时追加记录', async () => {
    const mockFetch = global.fetch as jest.Mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            records: [makeRecord({ id: 'rec-2', originalText: '加载的第二条记录' })],
            total: 2,
            page: 2,
            pageSize: 20,
          },
          error: null,
        }),
    })

    render(
      <HistoryList initialRecords={[makeRecord()]} initialTotal={2} pageSize={20} />
    )

    fireEvent.click(screen.getByRole('button', { name: /加载更多/ }))

    await waitFor(() => {
      expect(screen.getByText('加载的第二条记录')).toBeInTheDocument()
    })
  })

  it('卡片上有「重新改写」快捷按钮', () => {
    const record = makeRecord()
    render(<HistoryList initialRecords={[record]} initialTotal={1} pageSize={20} />)
    expect(screen.getByRole('button', { name: '重新改写' })).toBeInTheDocument()
  })

  it('点击卡片「重新改写」按钮后触发路由跳转', async () => {
    const mockFetch = global.fetch as jest.Mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            record: {
              id: 'rec-1',
              originalText: '这是一段测试内容，用于测试历史记录卡片的显示效果',
              contentType: 'opinion',
              createdAt: new Date('2026-03-27T10:00:00Z').toISOString(),
            },
            results: [{ id: 'res-1', platform: 'xiaohongshu', tone: 'standard' }],
          },
          error: null,
        }),
    })

    const record = makeRecord()
    render(<HistoryList initialRecords={[record]} initialTotal={1} pageSize={20} />)

    fireEvent.click(screen.getByRole('button', { name: '重新改写' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/app?'))
    })
  })
})
