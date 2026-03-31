'use client'

export type Tone = 'casual' | 'standard' | 'formal'

const TONE_LABELS: Record<Tone, string> = {
  casual: '口语化',
  standard: '标准',
  formal: '正式',
}

const TONES: Tone[] = ['casual', 'standard', 'formal']

interface ToneSelectorProps {
  value: Tone
  onChange: (tone: Tone) => void
  disabled?: boolean
}

export function ToneSelector({ value, onChange, disabled = false }: ToneSelectorProps) {
  const select = (tone: Tone) => {
    if (disabled) return
    onChange(tone)
  }

  const handleKeyDown = (e: React.KeyboardEvent, tone: Tone) => {
    if (disabled) return
    const idx = TONES.indexOf(tone)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      select(TONES[(idx + 1) % TONES.length])
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      select(TONES[(idx - 1 + TONES.length) % TONES.length])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium text-text-caption tracking-wide uppercase">语气风格</span>
      {/* 分段选择器样式 */}
      <div
        className="inline-flex rounded-lg border border-border-default bg-surface-2/60 p-0.5 gap-0.5"
        role="radiogroup"
        aria-label="语气风格选择"
      >
        {TONES.map((tone) => {
          const isSelected = value === tone
          return (
            <button
              key={tone}
              type="button"
              onClick={() => select(tone)}
              onKeyDown={(e) => handleKeyDown(e, tone)}
              disabled={disabled}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={[
                'flex-1 py-1.5 px-4 rounded-md text-[12.5px] font-medium transition-all duration-150',
                isSelected
                  ? 'bg-white text-accent shadow-sm border border-border-default'
                  : 'text-text-secondary hover:text-ink',
                disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {TONE_LABELS[tone]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
