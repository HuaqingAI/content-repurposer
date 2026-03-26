import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { WechatLoginButton } from '../wechat-login-button'

describe('WechatLoginButton', () => {
  it('renders with "微信登录" text', () => {
    render(<WechatLoginButton />)
    expect(screen.getByText('微信登录')).toBeInTheDocument()
  })

  it('button is enabled by default', () => {
    render(<WechatLoginButton />)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('clicking navigates to /api/auth/wechat/login', async () => {
    const mockNavigate = jest.fn()
    render(<WechatLoginButton onNavigate={mockNavigate} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(mockNavigate).toHaveBeenCalledWith('/api/auth/wechat/login')
  })

  it('shows "跳转中..." and disables button after click', async () => {
    const mockNavigate = jest.fn()
    render(<WechatLoginButton onNavigate={mockNavigate} />)
    const button = screen.getByRole('button')
    await act(async () => {
      fireEvent.click(button)
    })
    expect(screen.getByText('跳转中...')).toBeInTheDocument()
    expect(button).toBeDisabled()
  })
})
