'use client'

export type Platform = 'xiaohongshu' | 'wechat' | 'zhihu'

const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}

const PLATFORMS: Platform[] = ['xiaohongshu', 'wechat', 'zhihu']

interface PlatformSelectorProps {
  value: Platform[]
  onChange: (platforms: Platform[]) => void
  disabled?: boolean
}

export function PlatformSelector({ value, onChange, disabled = false }: PlatformSelectorProps) {
  const toggle = (platform: Platform) => {
    if (disabled) return
    if (value.includes(platform)) {
      if (value.length === 1) return // 至少保留一个平台（AC#1）
      onChange(value.filter((p) => p !== platform))
    } else {
      onChange([...value, platform])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-secondary">目标平台</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="目标平台选择">
        {PLATFORMS.map((platform) => {
          const isSelected = value.includes(platform)
          return (
            <button
              key={platform}
              type="button"
              onClick={() => toggle(platform)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={[
                'px-4 py-2 rounded-lg border text-sm transition-colors duration-150',
                isSelected
                  ? 'bg-accent-light border-accent text-accent font-medium'
                  : 'bg-surface-2 border-border-default text-text-secondary hover:border-border-focus',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {PLATFORM_LABELS[platform]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
