import React from 'react'
import { render, act, waitFor } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { WechatSessionContent } from '../wechat-session-content'

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('WechatSessionContent', () => {
  it('shows loading message while exchange is pending', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})) // never resolves

    let result: ReturnType<typeof render>
    await act(async () => {
      result = render(<WechatSessionContent />)
    })
    expect(result!.getByText('正在登录...')).toBeInTheDocument()
  })

  it('calls /api/auth/wechat/exchange on mount', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    await act(async () => {
      render(<WechatSessionContent />)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/wechat/exchange')
    })
  })

  it('exchange { success: true } → redirects to /app', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    await act(async () => {
      render(<WechatSessionContent />)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/app')
    })
  })

  it('exchange { success: false } → redirects to /login?error=wechat_failed', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: false }),
    })

    await act(async () => {
      render(<WechatSessionContent />)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?error=wechat_failed')
    })
  })

  it('network error → redirects to /login?error=wechat_failed', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network error'))

    await act(async () => {
      render(<WechatSessionContent />)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?error=wechat_failed')
    })
  })

  it('ref guard prevents double fetch in Strict Mode', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ success: true }),
    })

    await act(async () => {
      render(<WechatSessionContent />)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})
