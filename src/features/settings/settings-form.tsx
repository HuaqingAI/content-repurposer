'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'

interface FormValues {
  displayName: string
}

interface SettingsFormProps {
  displayName: string
  maskedPhone: string | null
  createdAt: string
}

export function SettingsForm({ displayName, maskedPhone, createdAt }: SettingsFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  const form = useForm<FormValues>({
    defaultValues: { displayName },
  })

  async function onSubmit(values: FormValues) {
    if (status === 'loading') return
    setStatus('loading')
    setErrorMessage('')
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: values.displayName.trim() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setStatus('error')
        setErrorMessage(json.error?.message ?? '更新失败，请稍后重试')
      } else {
        setStatus('success')
        form.reset({ displayName: values.displayName.trim() })
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        successTimerRef.current = setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('error')
      setErrorMessage('网络错误，请稍后重试')
    }
  }

  const formattedDate = new Date(createdAt).toISOString().slice(0, 10)

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">个人设置</h1>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
          <p className="text-gray-900">{maskedPhone ?? '未绑定'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">注册时间</label>
          <p className="text-gray-900">{formattedDate}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            显示名称
          </label>
          <input
            id="displayName"
            {...form.register('displayName', {
              required: '名称不能为空',
              maxLength: { value: 50, message: '名称不超过 50 个字符' },
              validate: (v) => v.trim().length > 0 || '名称不能为空白',
            })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {form.formState.errors.displayName && (
            <p className="mt-1 text-sm text-red-500">
              {form.formState.errors.displayName.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? '保存中...' : '保存'}
        </button>

        {status === 'success' && (
          <p className="text-sm text-green-600 text-center">✓ 保存成功</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-500 text-center">{errorMessage}</p>
        )}
      </form>
    </div>
  )
}
