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
      <span className="text-xs font-medium text-text-secondary">语气风格</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="语气风格选择">
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
                'px-4 py-2 rounded-lg border text-sm transition-colors duration-150',
                isSelected
                  ? 'bg-accent-light border-accent text-accent font-medium'
                  : 'bg-surface-2 border-border-default text-text-secondary hover:border-border-focus',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
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
