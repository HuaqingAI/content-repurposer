'use client'

import { useState, useEffect, useCallback } from 'react'

type UserListItem = {
  id: string
  phone: string | null
  displayName: string
  role: string
  isBanned: boolean
  createdAt: string
  rewriteCount: number
  lastActiveAt: string | null
}

type UsersResponse = {
  data: {
    users: UserListItem[]
    total: number
    page: number
    pageSize: number
  } | null
  error: { code: string; message: string } | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function UserTable() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // userId

  const pageSize = 20

  // 防抖：300ms 后更新 debouncedSearch 并重置页码
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchUsers = useCallback(async (searchVal: string, pageVal: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(pageVal), pageSize: String(pageSize) })
      if (searchVal) params.set('search', searchVal)
      const res = await fetch(`/api/admin/users?${params}`)
      const json: UsersResponse = await res.json()
      if (!res.ok || json.error) {
        setError(json.error?.message ?? '加载失败')
        return
      }
      setUsers(json.data?.users ?? [])
      setTotal(json.data?.total ?? 0)
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers(debouncedSearch, page)
  }, [fetchUsers, debouncedSearch, page])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  const handleToggleBan = async (userId: string, currentBanned: boolean) => {
    const action = currentBanned ? '启用' : '禁用'
    if (!window.confirm(`确定要${action}该用户吗？`)) {
      return
    }

    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banned: !currentBanned }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        alert(json.error?.message ?? '操作失败')
        return
      }
      // 用服务端返回的 isBanned 值更新本地状态（而非本地推导值）
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isBanned: json.data.isBanned } : u))
      )
    } catch {
      alert('网络错误，请稍后重试')
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      {/* 搜索栏 */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="按手机号搜索（输入前缀）"
          value={search}
          onChange={handleSearchChange}
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">手机号</th>
              <th className="px-4 py-3">昵称</th>
              <th className="px-4 py-3">改写次数</th>
              <th className="px-4 py-3">注册时间</th>
              <th className="px-4 py-3">最后活跃</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  加载中…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  暂无用户数据
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{u.phone ?? '—'}</td>
                  <td className="px-4 py-3">{u.displayName}</td>
                  <td className="px-4 py-3 text-center">{u.rewriteCount}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.lastActiveAt)}</td>
                  <td className="px-4 py-3">
                    {u.isBanned ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        已禁用
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        正常
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleBan(u.id, u.isBanned)}
                      disabled={actionLoading === u.id}
                      className={`text-xs px-3 py-1 rounded border transition-colors ${
                        u.isBanned
                          ? 'border-green-500 text-green-600 hover:bg-green-50'
                          : 'border-red-400 text-red-600 hover:bg-red-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {actionLoading === u.id ? '处理中…' : u.isBanned ? '启用' : '禁用'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>共 {total} 条记录</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="px-3 py-1">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
