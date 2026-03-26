import type { Metadata } from 'next'
import { LoginForm } from '@/features/auth/login-form'

export const metadata: Metadata = {
  title: '登录 - 适文',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorMessage = error === 'wechat_failed' ? '微信登录失败，请重试' : undefined
  return <LoginForm errorMessage={errorMessage} />
}
