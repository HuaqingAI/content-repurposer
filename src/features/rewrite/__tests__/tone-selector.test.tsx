// @jest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react'
import { ToneSelector } from '../tone-selector'

describe('ToneSelector', () => {
  it('渲染三个语气选项', () => {
    render(<ToneSelector value="standard" onChange={() => {}} />)
    expect(screen.getByText('口语化')).toBeInTheDocument()
    expect(screen.getByText('标准')).toBeInTheDocument()
    expect(screen.getByText('正式')).toBeInTheDocument()
  })

  it('当前选中值的按钮 aria-checked 为 true', () => {
    render(<ToneSelector value="standard" onChange={() => {}} />)
    expect(screen.getByText('标准').closest('button')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('口语化').closest('button')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('正式').closest('button')).toHaveAttribute('aria-checked', 'false')
  })

  it('点击未选中语气触发 onChange', () => {
    const handleChange = jest.fn()
    render(<ToneSelector value="standard" onChange={handleChange} />)
    fireEvent.click(screen.getByText('口语化'))
    expect(handleChange).toHaveBeenCalledWith('casual')
  })

  it('点击已选中语气也触发 onChange（允许重复点击）', () => {
    const handleChange = jest.fn()
    render(<ToneSelector value="formal" onChange={handleChange} />)
    fireEvent.click(screen.getByText('正式'))
    expect(handleChange).toHaveBeenCalledWith('formal')
  })

  it('disabled 时点击不触发 onChange', () => {
    const handleChange = jest.fn()
    render(<ToneSelector value="standard" onChange={handleChange} disabled />)
    fireEvent.click(screen.getByText('口语化'))
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('disabled 时所有按钮有 disabled 属性', () => {
    render(<ToneSelector value="standard" onChange={() => {}} disabled />)
    const buttons = screen.getAllByRole('radio')
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })
})
