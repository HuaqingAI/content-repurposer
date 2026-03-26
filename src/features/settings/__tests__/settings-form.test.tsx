import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsForm } from '../settings-form'

// mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

const defaultProps = {
  displayName: '测试用户',
  maskedPhone: '138****1234',
  createdAt: new Date('2026-01-15T10:00:00Z'),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('SettingsForm', () => {
  it('渲染用户信息：显示名称、手机号、注册时间', () => {
    render(<SettingsForm {...defaultProps} />)

    expect(screen.getByDisplayValue('测试用户')).toBeInTheDocument()
    expect(screen.getByText('138****1234')).toBeInTheDocument()
    expect(screen.getByText('2026-01-15')).toBeInTheDocument()
  })

  it('手机号为 null 时显示"未绑定"', () => {
    render(<SettingsForm {...defaultProps} maskedPhone={null} />)
    expect(screen.getByText('未绑定')).toBeInTheDocument()
  })

  it('有保存按钮', () => {
    render(<SettingsForm {...defaultProps} />)
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('提交时调用正确的 PATCH 请求', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { userId: 'user-123' }, error: null }),
    })

    render(<SettingsForm {...defaultProps} />)

    const input = screen.getByLabelText('显示名称')
    fireEvent.change(input, { target: { value: '新名称' } })

    const submitBtn = screen.getByRole('button', { name: '保存' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: '新名称' }),
      })
    })
  })

  it('保存成功后显示成功提示', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { userId: 'user-123' }, error: null }),
    })

    render(<SettingsForm {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.getByText(/保存成功/)).toBeInTheDocument()
    })
  })

  it('服务端返回错误时显示错误提示', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        data: null,
        error: { code: 'UPDATE_FAILED', message: '更新失败，请稍后重试' },
      }),
    })

    render(<SettingsForm {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.getByText('更新失败，请稍后重试')).toBeInTheDocument()
    })
  })

  it('网络异常时显示错误提示', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<SettingsForm {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.getByText('网络错误，请稍后重试')).toBeInTheDocument()
    })
  })

  it('displayName 为空时不提交，显示校验错误', async () => {
    render(<SettingsForm {...defaultProps} />)

    const input = screen.getByLabelText('显示名称')
    fireEvent.change(input, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.getByText('名称不能为空')).toBeInTheDocument()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
