import { render, screen } from '@testing-library/react'
import { StreamingText } from '../streaming-text'

describe('StreamingText', () => {
  it('renders provided text content', () => {
    render(<StreamingText text="这是一段改写内容" />)
    expect(screen.getByText('这是一段改写内容')).toBeInTheDocument()
  })

  it('shows cursor element when isStreaming=true', () => {
    render(<StreamingText text="内容" isStreaming={true} />)
    const cursor = document.querySelector('[aria-hidden="true"]')
    expect(cursor).toBeInTheDocument()
  })

  it('does not show cursor element when isStreaming=false', () => {
    render(<StreamingText text="内容" isStreaming={false} />)
    const cursor = document.querySelector('[aria-hidden="true"]')
    expect(cursor).not.toBeInTheDocument()
  })

  it('shows placeholder text when text is empty and isStreaming=true', () => {
    render(<StreamingText text="" isStreaming={true} />)
    expect(screen.getByText('生成中...')).toBeInTheDocument()
  })

  it('shows nothing special when text is empty and isStreaming=false', () => {
    render(<StreamingText text="" isStreaming={false} />)
    expect(screen.queryByText('生成中...')).not.toBeInTheDocument()
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<StreamingText text="test" className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
