// @jest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react'
import { PlatformSelector } from '../platform-selector'
import type { Platform } from '../platform-selector'

describe('PlatformSelector', () => {
  it('渲染三个平台选项', () => {
    render(<PlatformSelector value={[]} onChange={() => {}} />)
    expect(screen.getByText('小红书')).toBeInTheDocument()
    expect(screen.getByText('微信公众号')).toBeInTheDocument()
    expect(screen.getByText('知乎')).toBeInTheDocument()
  })

  it('点击未选中平台触发 onChange 并添加到选中集合', () => {
    const handleChange = jest.fn()
    render(<PlatformSelector value={[]} onChange={handleChange} />)
    fireEvent.click(screen.getByText('小红书'))
    expect(handleChange).toHaveBeenCalledWith(['xiaohongshu'])
  })

  it('点击已选中平台触发 onChange 并从集合移除', () => {
    const handleChange = jest.fn()
    const initial: Platform[] = ['xiaohongshu', 'zhihu']
    render(<PlatformSelector value={initial} onChange={handleChange} />)
    fireEvent.click(screen.getByText('小红书'))
    expect(handleChange).toHaveBeenCalledWith(['zhihu'])
  })

  it('选中的平台按钮 aria-pressed 为 true', () => {
    render(<PlatformSelector value={['wechat']} onChange={() => {}} />)
    expect(screen.getByText('微信公众号').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('小红书').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('disabled 时点击不触发 onChange', () => {
    const handleChange = jest.fn()
    render(<PlatformSelector value={[]} onChange={handleChange} disabled />)
    fireEvent.click(screen.getByText('小红书'))
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('disabled 时所有按钮有 disabled 属性', () => {
    render(<PlatformSelector value={[]} onChange={() => {}} disabled />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })
})
