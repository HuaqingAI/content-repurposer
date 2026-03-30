'use client'

import { useEffect, useRef, useCallback } from 'react'

const MIN_LENGTH = 50
const MAX_LENGTH = 5000
const MAX_HEIGHT = 400 // px

// 叠加层字体规格必须与 textarea Tailwind 类完全一致：
// text-[13.5px] → fontSize, leading-[1.7] → lineHeight, px-3 py-3 → padding(12px)
const OVERLAY_FONT_SIZE = '13.5px'
const OVERLAY_LINE_HEIGHT = '1.7'
const OVERLAY_PADDING = '12px'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TextInput({ value, onChange, disabled = false }: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // 使用 Unicode code point 计数，避免 emoji/生僻字（surrogate pair）被计为 2
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

  // 叠加层挂载时同步 textarea 的 scrollTop（isOver 切换导致 overlay remount 会重置 scrollTop）
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

  // AC#2：isUnder 时字数提示变为警告色（amber）；isOver 时变为红色
  const countColorClass = isOver ? 'text-red-500' : isUnder ? 'text-amber-500' : 'text-text-caption'

  return (
    <div className="flex flex-col gap-1">
      {/* 输入框容器（叠加层 + textarea） */}
      <div className="relative">
        {/* 叠加高亮层（仅超出时渲染，pointer-events-none 不拦截事件） */}
        {isOver && (
          <div
            ref={overlayRef}
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
            style={{
              // 必须与 textarea 完全一致的字体/行高/内边距，border 补偿 textarea 1px border-box 偏移
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
            'relative w-full resize-none rounded-lg px-3 py-3 text-[13.5px] leading-[1.7]',
            'border transition-colors duration-150 font-[inherit]',
            'focus:outline-none',
            isOver ? 'bg-transparent' : 'bg-surface-2 focus:bg-white',
            isOver
              ? 'border-red-400 focus:border-red-400'
              : 'border-border-default focus:border-border-focus',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          style={{ maxHeight: `${MAX_HEIGHT}px` }}
        />
      </div>

      {/* 字数统计 + 错误提示行 */}
      <div className="flex items-start justify-between gap-2 min-h-[16px]">
        {errorMessage ? (
          <p className="text-xs text-red-500">{errorMessage}</p>
        ) : (
          <span />
        )}
        <span className={`text-xs shrink-0 ${countColorClass}`}>
          {charCount} / {MAX_LENGTH} 字
        </span>
      </div>
    </div>
  )
}
