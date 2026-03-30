import DashboardStats from '@/features/admin/dashboard-stats'

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-800 mb-6">系统仪表盘</h1>
      <DashboardStats />
    </div>
  )
}
