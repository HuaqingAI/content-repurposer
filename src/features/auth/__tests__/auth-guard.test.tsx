import { render, screen, act } from '@testing-library/react'
import { AuthGuard } from '../auth-guard'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// auth state change callback captured for manual triggering
let capturedCallback: ((event: string) => void) | null = null
const mockUnsubscribe = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        capturedCallback = cb
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
      },
    },
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  capturedCallback = null
})

describe('AuthGuard', () => {
  it('正常渲染 children', () => {
    render(
      <AuthGuard>
        <span>测试内容</span>
      </AuthGuard>
    )
    expect(screen.getByText('测试内容')).toBeInTheDocument()
  })

  it('挂载后注册 onAuthStateChange 订阅', () => {
    render(
      <AuthGuard>
        <span>content</span>
      </AuthGuard>
    )
    expect(capturedCallback).not.toBeNull()
  })

  it('SIGNED_OUT 事件触发 router.push("/login")', () => {
    render(
      <AuthGuard>
        <span>content</span>
      </AuthGuard>
    )
    act(() => {
      capturedCallback?.('SIGNED_OUT')
    })
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('TOKEN_REFRESHED 事件不触发跳转', () => {
    render(
      <AuthGuard>
        <span>content</span>
      </AuthGuard>
    )
    act(() => {
      capturedCallback?.('TOKEN_REFRESHED')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('卸载时取消订阅', () => {
    const { unmount } = render(
      <AuthGuard>
        <span>content</span>
      </AuthGuard>
    )
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
