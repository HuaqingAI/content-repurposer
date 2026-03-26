import { PhoneOtpForm } from './phone-otp-form'
import { WechatLoginButton } from './wechat-login-button'

interface LoginFormProps {
  errorMessage?: string
}

export function LoginForm({ errorMessage }: LoginFormProps = {}) {
  return (
    <div className="w-full max-w-sm px-6 py-8">
      {/* 产品 Logo / 名称 */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">适文</h1>
        <p className="mt-1 text-sm text-gray-500">AI 内容改写助手</p>
      </div>

      {/* 错误提示（微信登录失败等） */}
      {errorMessage && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* 手机号登录 */}
      <PhoneOtpForm />

      {/* 分隔线 */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-gray-400">或</span>
        </div>
      </div>

      {/* 微信登录 */}
      <WechatLoginButton />
    </div>
  )
}
