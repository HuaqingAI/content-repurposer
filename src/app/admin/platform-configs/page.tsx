import { PlatformConfigEditor } from '@/features/admin/platform-config-editor'

export default function PlatformConfigsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">平台规则配置</h1>
        <p className="mt-1 text-sm text-gray-500">
          编辑各平台的 prompt 模板和风格规则，保存后即时生效（热更新）。每次保存自动创建新版本，历史版本保留可回溯。
        </p>
      </div>
      <PlatformConfigEditor />
    </div>
  )
}
