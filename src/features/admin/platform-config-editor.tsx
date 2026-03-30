'use client'

import { useEffect, useState, useCallback } from 'react'

type PlatformConfigItem = {
  id: string
  platform: string
  configVersion: number
  styleRules: unknown
  promptTemplate: string
  fewShotExamples: unknown
  isActive: boolean
  updatedAt: string
  updatedBy: string | null
}

type PlatformState = {
  configVersion: number
  styleRules: string
  promptTemplate: string
  fewShotExamples: string
  updatedAt: string | null
  updatedBy: string | null
  saving: boolean
  error: string | null
  success: boolean
}

const PLATFORMS: { key: string; label: string }[] = [
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'wechat', label: '微信公众号' },
  { key: 'zhihu', label: '知乎' },
]

function toJsonString(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

export function PlatformConfigEditor() {
  const [activeTab, setActiveTab] = useState('xiaohongshu')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [states, setStates] = useState<Record<string, PlatformState>>({})

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/platform-configs')
      const json = await res.json()
      if (!res.ok || json.error) {
        setLoadError(json.error?.message ?? '加载失败')
        return
      }
      const configs: PlatformConfigItem[] = json.data.configs
      const newStates: Record<string, PlatformState> = {}
      for (const p of PLATFORMS) {
        const found = configs.find((c) => c.platform === p.key)
        newStates[p.key] = {
          configVersion: found?.configVersion ?? 0,
          styleRules: toJsonString(found?.styleRules ?? {}),
          promptTemplate: found?.promptTemplate ?? '',
          fewShotExamples: toJsonString(found?.fewShotExamples ?? []),
          updatedAt: found?.updatedAt ?? null,
          updatedBy: found?.updatedBy ?? null,
          saving: false,
          error: null,
          success: false,
        }
      }
      setStates(newStates)
    } catch {
      setLoadError('网络错误，请刷新重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  function updateField(platform: string, field: keyof PlatformState, value: string) {
    setStates((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value, error: null, success: false },
    }))
  }

  async function handleSave(platform: string) {
    const state = states[platform]
    if (!state) return

    // 校验 JSON 字段
    let styleRulesParsed: unknown
    let fewShotParsed: unknown
    try {
      styleRulesParsed = JSON.parse(state.styleRules)
    } catch {
      setStates((prev) => ({
        ...prev,
        [platform]: { ...prev[platform], error: 'style_rules 格式错误，请输入合法 JSON' },
      }))
      return
    }
    try {
      fewShotParsed = JSON.parse(state.fewShotExamples)
    } catch {
      setStates((prev) => ({
        ...prev,
        [platform]: { ...prev[platform], error: 'few_shot_examples 格式错误，请输入合法 JSON' },
      }))
      return
    }
    if (!state.promptTemplate.trim()) {
      setStates((prev) => ({
        ...prev,
        [platform]: { ...prev[platform], error: 'prompt_template 不能为空' },
      }))
      return
    }

    setStates((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], saving: true, error: null, success: false },
    }))

    try {
      const res = await fetch('/api/admin/platform-configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          styleRules: styleRulesParsed,
          promptTemplate: state.promptTemplate.trim(),
          fewShotExamples: fewShotParsed,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setStates((prev) => ({
          ...prev,
          [platform]: { ...prev[platform], saving: false, error: json.error?.message ?? '保存失败' },
        }))
        return
      }
      setStates((prev) => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          saving: false,
          success: true,
          configVersion: json.data.configVersion,
          updatedAt: json.data.updatedAt ?? new Date().toISOString(),
        },
      }))
    } catch {
      setStates((prev) => ({
        ...prev,
        [platform]: { ...prev[platform], saving: false, error: '网络错误，请重试' },
      }))
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">加载中...</div>
  }
  if (loadError) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-3">{loadError}</p>
        <button
          onClick={loadConfigs}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          重新加载
        </button>
      </div>
    )
  }

  const currentState = states[activeTab]

  return (
    <div className="space-y-4">
      {/* Tab 导航 */}
      <div className="flex border-b border-gray-200">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActiveTab(p.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === p.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 编辑区 */}
      {currentState && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          {/* 版本信息 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                v{currentState.configVersion}
              </span>
              {currentState.updatedAt && (
                <span className="text-xs text-gray-400">
                  最后更新：{new Date(currentState.updatedAt).toLocaleString('zh-CN')}
                  {currentState.updatedBy && ` · 操作人 ${currentState.updatedBy.slice(0, 8)}`}
                </span>
              )}
            </div>
          </div>

          {/* prompt_template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt Template
            </label>
            <textarea
              rows={10}
              value={currentState.promptTemplate}
              onChange={(e) => updateField(activeTab, 'promptTemplate', e.target.value)}
              className="w-full font-mono text-sm border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="输入 prompt 模板..."
            />
          </div>

          {/* style_rules */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Style Rules <span className="text-gray-400 font-normal">(JSON)</span>
            </label>
            <textarea
              rows={6}
              value={currentState.styleRules}
              onChange={(e) => updateField(activeTab, 'styleRules', e.target.value)}
              className="w-full font-mono text-sm border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="{}"
            />
          </div>

          {/* few_shot_examples */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Few-Shot Examples <span className="text-gray-400 font-normal">(JSON array)</span>
            </label>
            <textarea
              rows={6}
              value={currentState.fewShotExamples}
              onChange={(e) => updateField(activeTab, 'fewShotExamples', e.target.value)}
              className="w-full font-mono text-sm border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="[]"
            />
          </div>

          {/* 错误 / 成功提示 */}
          {currentState.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-3">{currentState.error}</p>
          )}
          {currentState.success && (
            <p className="text-sm text-green-700 bg-green-50 rounded p-3">
              保存成功！已创建新版本 v{currentState.configVersion}，改写请求将立即使用新配置。
            </p>
          )}

          {/* 保存按钮 */}
          <div>
            <button
              onClick={() => handleSave(activeTab)}
              disabled={currentState.saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {currentState.saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
