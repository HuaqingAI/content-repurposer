'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PHONE_REGEX = /^1[3-9]\d{9}$/
const COOLDOWN_SECONDS = 60

function validatePhone(phone: string): string | null {
  if (!phone) return '请输入手机号'
  if (!PHONE_REGEX.test(phone)) return '请输入有效的手机号'
  return null
}

export function PhoneOtpForm() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startCooldown() {
    if (timerRef.current) clearInterval(timerRef.current)
    setCooldown(COOLDOWN_SECONDS)
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendOtp() {
    const err = validatePhone(phone)
    if (err) {
      setPhoneError(err)
      return
    }
    setPhoneError(null)
    setSendingOtp(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: `86${phone}` })
      if (error) {
        console.error('[OTP] signInWithOtp error:', error.message, error)
        setPhoneError(`发送失败: ${error.message}`)
        return
      }
      setOtpSent(true)
      startCooldown()
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleVerifyOtp() {
    if (!otp || otp.length < 6) {
      setOtpError('请输入6位验证码')
      return
    }
    setOtpError(null)
    setVerifying(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `86${phone}`,
        token: otp,
        type: 'sms',
      })
      if (error) {
        // Supabase returns "Token has expired" for timed-out OTPs
        // and "Token has expired or is invalid" for wrong OTPs
        const msg = error.message ?? ''
        if (msg === 'Token has expired') {
          setOtpError('验证码已过期，请重新获取')
        } else {
          setOtpError('验证码错误或已过期')
        }
        return
      }
      if (data.session) {
        const res = await fetch('/api/auth/sync-user', { method: 'POST' })
        if (!res.ok) {
          setOtpError('登录成功但账号同步失败，请重试')
          return
        }
        router.push('/app')
      }
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* 手机号输入 */}
      <div className="space-y-1">
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          手机号
        </label>
        <div className="flex gap-2">
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setPhoneError(null)
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sendingOtp || otpSent}
          />
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={sendingOtp || cooldown > 0}
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingOtp ? (
              <span className="flex items-center gap-1">
                <Spinner />
                发送中
              </span>
            ) : cooldown > 0 ? (
              `${cooldown}s 后重试`
            ) : (
              '获取验证码'
            )}
          </button>
        </div>
        {phoneError && (
          <p className="text-xs text-red-500">{phoneError}</p>
        )}
      </div>

      {/* 验证码输入 */}
      {otpSent && (
        <div className="space-y-1">
          <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
            验证码
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="请输入6位验证码"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, ''))
              setOtpError(null)
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {otpError && (
            <p className="text-xs text-red-500">{otpError}</p>
          )}
        </div>
      )}

      {/* 提交按钮 */}
      {otpSent && (
        <button
          type="button"
          onClick={handleVerifyOtp}
          disabled={verifying}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />
              验证中
            </span>
          ) : (
            '登录 / 注册'
          )}
        </button>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
