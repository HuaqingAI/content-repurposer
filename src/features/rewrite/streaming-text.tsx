'use client'

interface StreamingTextProps {
  text: string
  isStreaming?: boolean
  className?: string
}

export function StreamingText({ text, isStreaming = false, className }: StreamingTextProps) {
  const isEmpty = text.length === 0

  return (
    <div
      className={[
        'min-h-[120px] rounded-lg border border-border-default bg-surface-2 p-4',
        'text-[13.5px] leading-[1.7] text-gray-800 whitespace-pre-wrap break-words',
        className ?? '',
      ].join(' ')}
    >
      {isEmpty && isStreaming ? (
        <span className="text-text-secondary text-sm">生成中...</span>
      ) : (
        <>
          {text}
          {isStreaming && (
            <span
              aria-hidden="true"
              className="inline-block w-[2px] h-[1em] bg-accent ml-0.5 align-text-bottom animate-pulse"
            />
          )}
        </>
      )}
    </div>
  )
}
