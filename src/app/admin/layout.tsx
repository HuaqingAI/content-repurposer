export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3">
        <span className="text-sm font-medium text-gray-500">适文 · 管理后台</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
