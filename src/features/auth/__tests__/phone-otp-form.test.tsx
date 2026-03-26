import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { PhoneOtpForm } from '../phone-otp-form'

// Mock Supabase client
const mockSignInWithOtp = jest.fn()
const mockVerifyOtp = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
    },
  })),
}))

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock fetch for /api/auth/sync-user
global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

describe('PhoneOtpForm - 手机号格式校验', () => {
  it('空手机号点击"获取验证码"显示错误', async () => {
    render(<PhoneOtpForm />)
    const sendBtn = screen.getByRole('button', { name: '获取验证码' })
    await act(async () => {
      fireEvent.click(sendBtn)
    })
    expect(screen.getByText('请输入手机号')).toBeInTheDocument()
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('非法手机号显示错误，不发出网络请求', async () => {
    render(<PhoneOtpForm />)
    const phoneInput = screen.getByPlaceholderText('请输入手机号')
    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: '12345' } })
      fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    })
    expect(screen.getByText('请输入有效的手机号')).toBeInTheDocument()
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('不以1开头的11位数字显示错误', async () => {
    render(<PhoneOtpForm />)
    const phoneInput = screen.getByPlaceholderText('请输入手机号')
    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: '23456789012' } })
      fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    })
    expect(screen.getByText('请输入有效的手机号')).toBeInTheDocument()
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('有效手机号可以发送OTP', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    render(<PhoneOtpForm />)
    const phoneInput = screen.getByPlaceholderText('请输入手机号')
    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: '13800000001' } })
      fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    })
    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith({ phone: '+8613800000001' })
    })
  })
})

describe('PhoneOtpForm - 倒计时逻辑', () => {
  it('发送OTP后按钮进入倒计时禁用状态', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    render(<PhoneOtpForm />)
    const phoneInput = screen.getByPlaceholderText('请输入手机号')
    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: '13800000001' } })
      fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    })
    await waitFor(() => {
      const btn = screen.queryByRole('button', { name: /\d+s 后重试/ })
      expect(btn).not.toBeNull()
      expect(btn).toBeDisabled()
    })
  })

  it('60秒倒计时结束后按钮恢复可点击', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    render(<PhoneOtpForm />)
    const phoneInput = screen.getByPlaceholderText('请输入手机号')
    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: '13800000001' } })
      fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /\d+s 后重试/ })).not.toBeNull()
    })
    await act(async () => {
      jest.advanceTimersByTime(60000)
    })
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: '获取验证码' })
      expect(btn).not.toBeDisabled()
    })
  })
})

describe('PhoneOtpForm - 错误状态展示', () => {
  async function setupAfterOtpSent() {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    render(<PhoneOtpForm />)
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('请输入手机号'), {
        target: { value: '13800000001' },
      })
      fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    })
    await waitFor(() => screen.getByPlaceholderText('请输入6位验证码'))
  }

  it('验证码错误显示"验证码错误或已过期"，手机号不清空', async () => {
    await setupAfterOtpSent()
    mockVerifyOtp.mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    })
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('请输入6位验证码'), {
        target: { value: '000000' },
      })
      fireEvent.click(screen.getByRole('button', { name: '登录 / 注册' }))
    })
    await waitFor(() => {
      expect(screen.getByText('验证码错误或已过期')).toBeInTheDocument()
    })
    // 手机号输入框内容不清空
    expect(screen.getByDisplayValue('13800000001')).toBeInTheDocument()
  })

  it('验证码过期显示"验证码已过期，请重新获取"', async () => {
    await setupAfterOtpSent()
    mockVerifyOtp.mockResolvedValue({
      data: {},
      error: { message: 'Token has expired' },
    })
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('请输入6位验证码'), {
        target: { value: '000000' },
      })
      fireEvent.click(screen.getByRole('button', { name: '登录 / 注册' }))
    })
    await waitFor(() => {
      expect(screen.getByText('验证码已过期，请重新获取')).toBeInTheDocument()
    })
  })

  it('验证成功后跳转到 /app', async () => {
    await setupAfterOtpSent()
    mockVerifyOtp.mockResolvedValue({
      data: { session: { user: { id: 'test-uuid', phone: '+8613800000001' } } },
      error: null,
    })
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('请输入6位验证码'), {
        target: { value: '123456' },
      })
      fireEvent.click(screen.getByRole('button', { name: '登录 / 注册' }))
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/sync-user', { method: 'POST' })
      expect(mockPush).toHaveBeenCalledWith('/app')
    })
  })
})
