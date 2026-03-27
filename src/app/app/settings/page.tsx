import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SettingsForm } from '@/features/settings/settings-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '个人设置 | 适文',
}

function maskPhone(phone: string): string {
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  }
  if (phone.length < 4) {
    return '****'
  }
  return `${phone.slice(0, 2)}****${phone.slice(-2)}`
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // proxy.ts 已保证登录，此处 user 不应为 null；防御性处理
  if (!user) return null

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) redirect('/login')

  const maskedPhone = dbUser.phone ? maskPhone(dbUser.phone) : null

  return (
    <SettingsForm
      displayName={dbUser.displayName ?? ''}
      maskedPhone={maskedPhone}
      createdAt={dbUser.createdAt.toISOString()}
    />
  )
}
