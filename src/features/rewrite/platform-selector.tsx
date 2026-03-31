'use client'

export type Platform = 'xiaohongshu' | 'wechat' | 'zhihu'

const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}

const PLATFORM_DOTS: Record<Platform, string> = {
  xiaohongshu: '#ff2442',
  wechat: '#07c160',
  zhihu: '#0066ff',
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
      if (value.length === 1) return
      onChange(value.filter((p) => p !== platform))
    } else {
      onChange([...value, platform])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium text-text-caption tracking-wide uppercase">目标平台</span>
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
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12.5px] font-medium transition-all duration-150',
                isSelected
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-transparent border-border-default text-text-secondary hover:border-accent/35 hover:bg-accent-muted/50',
                disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span
                className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : PLATFORM_DOTS[platform] }}
              />
              {PLATFORM_LABELS[platform]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
