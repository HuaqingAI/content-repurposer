'use client'

import { useEffect, useRef, useCallback } from 'react'

const MIN_LENGTH = 50
const MAX_LENGTH = 5000
const MAX_HEIGHT = 400 // px

// 叠加层字体规格必须与 textarea Tailwind 类完全一致：
// text-[13.5px] → fontSize, leading-[1.7] → lineHeight, px-4 py-3.5 → padding
const OVERLAY_FONT_SIZE = '13.5px'
const OVERLAY_LINE_HEIGHT = '1.7'
const OVERLAY_PADDING = '14px 16px'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TextInput({ value, onChange, disabled = false }: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const charCount = [...value].length
  const isUnder = charCount < MIN_LENGTH && charCount > 0
  const isOver = charCount > MAX_LENGTH

  // Auto-grow 高度
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  // 叠加层挂载时同步 textarea 的 scrollTop
  useEffect(() => {
    if (isOver && overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [isOver])

  // 同步叠加层滚动（当超出限制时）
  const handleScroll = useCallback(() => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const errorMessage = isUnder
    ? '原文至少需要 50 字'
    : isOver
    ? '原文超出 5000 字限制'
    : null

  const countColorClass = isOver
    ? 'text-red-500'
    : isUnder
    ? 'text-amber-500'
    : 'text-text-caption'

  return (
    <div className="flex flex-col gap-1.5">
      {/* 输入框容器（叠加层 + textarea） */}
      <div className="relative">
        {/* 叠加高亮层（仅超出时渲染） */}
        {isOver && (
          <div
            ref={overlayRef}
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
            style={{
              fontFamily: 'inherit',
              fontSize: OVERLAY_FONT_SIZE,
              lineHeight: OVERLAY_LINE_HEIGHT,
              padding: OVERLAY_PADDING,
              border: '1px solid transparent',
              color: 'transparent',
            }}
          >
            <span>{value.slice(0, MAX_LENGTH)}</span>
            <span className="bg-red-100">{value.slice(MAX_LENGTH)}</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          disabled={disabled}
          aria-label="原文输入框"
          placeholder="将文章内容粘贴到这里..."
          rows={6}
          className={[
            'relative w-full resize-none rounded-xl px-4 py-3.5 text-[13.5px] leading-[1.7] text-text-primary placeholder:text-text-caption',
            'border transition-all duration-150 font-[inherit]',
            'focus:outline-none focus:ring-2',
            isOver
              ? 'bg-transparent border-red-400 focus:border-red-400 focus:ring-red-100'
              : 'bg-paper border-border-default focus:border-accent/40 focus:ring-accent/10 focus:bg-white',
            disabled ? 'opacity-45 cursor-not-allowed' : '',
          ].join(' ')}
          style={{ maxHeight: `${MAX_HEIGHT}px` }}
        />
      </div>

      {/* 字数统计 + 错误提示行 */}
      <div className="flex items-center justify-between gap-2 min-h-[16px]">
        {errorMessage ? (
          <p className="text-[11.5px] text-red-500">{errorMessage}</p>
        ) : (
          <span />
        )}
        <span className={`text-[11.5px] shrink-0 tabular-nums ${countColorClass}`}>
          {charCount} / {MAX_LENGTH} 字
        </span>
      </div>
    </div>
  )
}
