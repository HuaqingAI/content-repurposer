// @jest-environment jsdom

import { render, screen, fireEvent, act } from '@testing-library/react'
import { CopyButton } from '../copy-button'

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
  writable: true,
  configurable: true,
})

describe('CopyButton', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(navigator.clipboard.writeText as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('默认渲染显示"复制"文字', () => {
    render(<CopyButton text="测试文本" />)
    expect(screen.getByRole('button', { name: '复制' })).toBeInTheDocument()
    expect(screen.getByText('复制')).toBeInTheDocument()
  })

  it('点击后调用 navigator.clipboard.writeText，参数为传入的 text', async () => {
    render(<CopyButton text="要复制的内容" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('要复制的内容')
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
  })

  it('点击后显示"已复制 ✓"', async () => {
    render(<CopyButton text="内容" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByText('已复制 ✓')).toBeInTheDocument()
  })

  it('1.5 秒后恢复显示"复制"', async () => {
    render(<CopyButton text="内容" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByText('已复制 ✓')).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(1500)
    })
    expect(screen.getByText('复制')).toBeInTheDocument()
    expect(screen.queryByText('已复制 ✓')).not.toBeInTheDocument()
  })

  it('clipboard 抛出异常时，组件不崩溃，不显示错误信息', async () => {
    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error('Permission denied')
    )
    render(<CopyButton text="内容" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    // 仍显示"复制"，无错误
    expect(screen.getByText('复制')).toBeInTheDocument()
    expect(screen.queryByText('已复制 ✓')).not.toBeInTheDocument()
  })

  it('点击时 e.stopPropagation 被调用', async () => {
    const parentClickHandler = jest.fn()
    render(
      <div onClick={parentClickHandler}>
        <CopyButton text="内容" />
      </div>
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(parentClickHandler).not.toHaveBeenCalled()
  })
})
