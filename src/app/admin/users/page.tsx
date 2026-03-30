import UserTable from '@/features/admin/user-table'

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-800 mb-6">用户管理</h1>
      <UserTable />
    </div>
  )
}
