// @jest-environment jsdom

import { render, screen } from '@testing-library/react'
import HomePage, { metadata } from '../page'

jest.mock('next/link', () => {
  return function Link({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

describe('HomePage', () => {
  it('renders the product name', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1, name: '适文' })).toBeInTheDocument()
  })

  it('renders the value proposition', () => {
    render(<HomePage />)
    expect(screen.getByText('一篇文章 → 多平台原生内容')).toBeInTheDocument()
  })

  it('renders all three platform names', () => {
    render(<HomePage />)
    // TrialWidget also shows platform buttons, so multiple elements exist — use getAllByText
    expect(screen.getAllByText('小红书').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('微信公众号').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('知乎').length).toBeGreaterThanOrEqual(1)
  })

  it('renders feature titles', () => {
    render(<HomePage />)
    expect(screen.getByText('语义级改写')).toBeInTheDocument()
    expect(screen.getByText('零学习成本')).toBeInTheDocument()
    expect(screen.getByText('多平台一键')).toBeInTheDocument()
  })

  it('renders CTA links pointing to /login', () => {
    render(<HomePage />)
    const ctaLinks = screen.getAllByRole('link', { name: /免费试用|立即注册/ })
    expect(ctaLinks.length).toBeGreaterThanOrEqual(2)
    ctaLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/login')
    })
  })

  it('metadata title contains core SEO keywords', () => {
    expect(metadata.title as string).toContain('小红书')
    expect(metadata.title as string).toContain('公众号')
  })

  it('metadata description is present and non-empty', () => {
    expect(metadata.description).toBeTruthy()
    expect(String(metadata.description).length).toBeGreaterThan(10)
  })
})
