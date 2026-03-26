import { AuthGuard } from '@/features/auth/auth-guard'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* 导航栏：Epic 4a/4b 实现 */}
        <main>{children}</main>
      </div>
    </AuthGuard>
  )
}
