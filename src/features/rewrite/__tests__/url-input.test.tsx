// @jest-environment jsdom

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UrlInput } from '../url-input'

// mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockClear()
})

describe('UrlInput 渲染', () => {
  it('渲染输入框和提取正文按钮', () => {
    render(<UrlInput onExtracted={jest.fn()} onError={jest.fn()} />)
    expect(screen.getByPlaceholderText(/粘贴公众号/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '提取正文' })).toBeInTheDocument()
  })

  it('初始状态按钮 disabled（url 为空）', () => {
    render(<UrlInput onExtracted={jest.fn()} onError={jest.fn()} />)
    expect(screen.getByRole('button', { name: '提取正文' })).toBeDisabled()
  })

  it('输入 URL 后按钮可用', () => {
    render(<UrlInput onExtracted={jest.fn()} onError={jest.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/粘贴公众号/), {
      target: { value: 'https://mp.weixin.qq.com/s/abc' },
    })
    expect(screen.getByRole('button', { name: '提取正文' })).not.toBeDisabled()
  })
})

describe('UrlInput 提取成功', () => {
  it('提取成功 → onExtracted 被调用并传入正文', async () => {
    const onExtracted = jest.fn()
    mockFetch.mockResolvedValue({
      json: async () => ({ data: { success: true, text: '文章正文内容' }, error: null }),
      ok: true,
    })

    render(<UrlInput onExtracted={onExtracted} onError={jest.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/粘贴公众号/), {
      target: { value: 'https://mp.weixin.qq.com/s/abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提取正文' }))

    await waitFor(() => {
      expect(onExtracted).toHaveBeenCalledWith('文章正文内容')
    })
  })
})

describe('UrlInput loading 状态', () => {
  it('提取中按钮显示"提取中..."并禁用', async () => {
    const onExtracted = jest.fn()
    // fetch 永远 pending，模拟 loading 状态
    let resolveFetch: (v: unknown) => void
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )

    render(<UrlInput onExtracted={onExtracted} onError={jest.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/粘贴公众号/), {
      target: { value: 'https://mp.weixin.qq.com/s/abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提取正文' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '提取中...' })).toBeDisabled()
    })

    // 清理，resolve pending promise
    resolveFetch!({
      json: async () => ({ data: { success: true, text: '内容' }, error: null }),
    })
  })
})

describe('UrlInput 提取失败', () => {
  it('服务端返回 success:false → 错误文案显示，onError 被调用', async () => {
    const onError = jest.fn()
    mockFetch.mockResolvedValue({
      json: async () => ({
        data: { success: false, error: '不支持该链接来源' },
        error: null,
      }),
      ok: true,
    })

    render(<UrlInput onExtracted={jest.fn()} onError={onError} />)
    fireEvent.change(screen.getByPlaceholderText(/粘贴公众号/), {
      target: { value: 'https://www.bilibili.com/video/abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提取正文' }))

    await waitFor(() => {
      expect(screen.getByText('无法自动提取该链接的内容，请手动复制文章文本后粘贴')).toBeInTheDocument()
      expect(onError).toHaveBeenCalledWith('无法自动提取该链接的内容，请手动复制文章文本后粘贴')
    })
  })

  it('网络错误 → 错误文案显示，onError 被调用', async () => {
    const onError = jest.fn()
    mockFetch.mockRejectedValue(new Error('网络错误'))

    render(<UrlInput onExtracted={jest.fn()} onError={onError} />)
    fireEvent.change(screen.getByPlaceholderText(/粘贴公众号/), {
      target: { value: 'https://mp.weixin.qq.com/s/abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提取正文' }))

    await waitFor(() => {
      expect(screen.getByText('无法自动提取该链接的内容，请手动复制文章文本后粘贴')).toBeInTheDocument()
      expect(onError).toHaveBeenCalledWith('无法自动提取该链接的内容，请手动复制文章文本后粘贴')
    })
  })

  it('AbortError（超时）→ onError 被调用', async () => {
    const onError = jest.fn()
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    mockFetch.mockRejectedValue(abortError)

    render(<UrlInput onExtracted={jest.fn()} onError={onError} />)
    fireEvent.change(screen.getByPlaceholderText(/粘贴公众号/), {
      target: { value: 'https://mp.weixin.qq.com/s/abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提取正文' }))

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('无法自动提取该链接的内容，请手动复制文章文本后粘贴')
      expect(screen.getByText('无法自动提取该链接的内容，请手动复制文章文本后粘贴')).toBeInTheDocument()
    })
  })
})

describe('UrlInput disabled 状态', () => {
  it('disabled=true 时输入框和按钮都禁用', () => {
    render(<UrlInput onExtracted={jest.fn()} onError={jest.fn()} disabled />)
    expect(screen.getByPlaceholderText(/粘贴公众号/)).toBeDisabled()
    expect(screen.getByRole('button', { name: '提取正文' })).toBeDisabled()
  })
})
