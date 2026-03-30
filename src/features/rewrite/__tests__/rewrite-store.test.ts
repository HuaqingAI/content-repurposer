// @jest-environment jsdom

import { useRewriteStore } from '../rewrite-store'

function getState() {
  return useRewriteStore.getState()
}

function resetStore() {
  useRewriteStore.setState({
    text: '',
    platforms: [],
    tone: 'standard',
    status: 'idle',
    streamingTexts: {},
    activeTab: null,
    streamingPlatform: null,
    streamError: null,
    platformPackages: {},
    recordId: null,
  })
}

beforeEach(() => {
  resetStore()
})

describe('初始状态', () => {
  it('初始状态正确', () => {
    const state = getState()
    expect(state.text).toBe('')
    expect(state.platforms).toEqual([])
    expect(state.tone).toBe('standard')
    expect(state.status).toBe('idle')
    expect(state.streamingTexts).toEqual({})
    expect(state.activeTab).toBeNull()
    expect(state.streamingPlatform).toBeNull()
    expect(state.streamError).toBeNull()
    expect(state.platformPackages).toEqual({})
    expect(state.recordId).toBeNull()
  })
})

describe('输入状态更新', () => {
  it('setText 更新文本', () => {
    getState().setText('hello world')
    expect(getState().text).toBe('hello world')
  })

  it('setPlatforms 更新平台列表', () => {
    getState().setPlatforms(['xiaohongshu', 'zhihu'])
    expect(getState().platforms).toEqual(['xiaohongshu', 'zhihu'])
  })

  it('setTone 更新语气', () => {
    getState().setTone('formal')
    expect(getState().tone).toBe('formal')
  })
})

describe('deferred bug 修复：平台/语气变更后重置 idle', () => {
  it('status=complete 时修改平台，status 重置为 idle', () => {
    useRewriteStore.setState({ status: 'complete' })
    getState().setPlatforms(['wechat'])
    expect(getState().status).toBe('idle')
  })

  it('status=complete 时修改语气，status 重置为 idle', () => {
    useRewriteStore.setState({ status: 'complete' })
    getState().setTone('casual')
    expect(getState().status).toBe('idle')
  })

  it('status=idle 时修改平台，status 保持 idle', () => {
    getState().setPlatforms(['zhihu'])
    expect(getState().status).toBe('idle')
  })

  it('status=rewriting 时修改平台，status 保持 rewriting', () => {
    useRewriteStore.setState({ status: 'rewriting' })
    getState().setPlatforms(['wechat'])
    expect(getState().status).toBe('rewriting')
  })
})

describe('改写状态机流转', () => {
  it('startRewrite 重置流式状态，设置 rewriting', () => {
    useRewriteStore.setState({
      status: 'complete',
      streamingTexts: { xiaohongshu: '旧内容' },
      activeTab: 'xiaohongshu',
      streamingPlatform: 'xiaohongshu',
      streamError: '旧错误',
    })

    getState().startRewrite()

    const state = getState()
    expect(state.status).toBe('rewriting')
    expect(state.streamingTexts).toEqual({})
    expect(state.activeTab).toBeNull()
    expect(state.streamingPlatform).toBeNull()
    expect(state.streamError).toBeNull()
  })

  it('onPlatformStart 同时设置 activeTab 和 streamingPlatform', () => {
    getState().onPlatformStart('zhihu')
    expect(getState().activeTab).toBe('zhihu')
    expect(getState().streamingPlatform).toBe('zhihu')
  })

  it('appendChunk 追加内容到对应平台', () => {
    getState().appendChunk('xiaohongshu', '第一段')
    getState().appendChunk('xiaohongshu', '第二段')
    expect(getState().streamingTexts['xiaohongshu']).toBe('第一段第二段')
  })

  it('appendChunk 多平台互不干扰', () => {
    getState().appendChunk('xiaohongshu', '小红书内容')
    getState().appendChunk('wechat', '公众号内容')
    expect(getState().streamingTexts['xiaohongshu']).toBe('小红书内容')
    expect(getState().streamingTexts['wechat']).toBe('公众号内容')
  })

  it('completeRewrite 设置 complete 并清除 streamingPlatform', () => {
    useRewriteStore.setState({ status: 'rewriting', streamingPlatform: 'zhihu' })
    getState().completeRewrite()
    expect(getState().status).toBe('complete')
    expect(getState().streamingPlatform).toBeNull()
  })

  it('setStreamError 设置错误并恢复 idle', () => {
    useRewriteStore.setState({ status: 'rewriting', streamingPlatform: 'wechat' })
    getState().setStreamError('网络错误')
    expect(getState().streamError).toBe('网络错误')
    expect(getState().status).toBe('idle')
    expect(getState().streamingPlatform).toBeNull()
  })
})

describe('setActiveTab', () => {
  it('setActiveTab 仅更新 activeTab，不影响 streamingPlatform', () => {
    useRewriteStore.setState({ streamingPlatform: 'xiaohongshu', activeTab: 'xiaohongshu' })
    getState().setActiveTab('zhihu')
    expect(getState().activeTab).toBe('zhihu')
    expect(getState().streamingPlatform).toBe('xiaohongshu')
  })
})

describe('platformPackages 和 recordId', () => {
  it('setTitles 写入对应平台的 titles', () => {
    getState().setTitles('xiaohongshu', ['标题1', '标题2', '标题3'])
    expect(getState().platformPackages['xiaohongshu']?.titles).toEqual(['标题1', '标题2', '标题3'])
  })

  it('setTitles 不影响其他平台', () => {
    getState().setTitles('xiaohongshu', ['标题1'])
    expect(getState().platformPackages['wechat']).toBeUndefined()
  })

  it('setTags 写入对应平台的 tags', () => {
    getState().setTags('wechat', ['标签A', '标签B'])
    expect(getState().platformPackages['wechat']?.tags).toEqual(['标签A', '标签B'])
  })

  it('setHook 写入对应平台的 hook', () => {
    getState().setHook('zhihu', '欢迎留言讨论')
    expect(getState().platformPackages['zhihu']?.hook).toBe('欢迎留言讨论')
  })

  it('同一平台多次设置不同字段，字段间不互相覆盖', () => {
    getState().setTitles('xiaohongshu', ['标题1', '标题2', '标题3'])
    getState().setTags('xiaohongshu', ['标签1'])
    getState().setHook('xiaohongshu', '引导语内容')
    const pkg = getState().platformPackages['xiaohongshu']
    expect(pkg?.titles).toEqual(['标题1', '标题2', '标题3'])
    expect(pkg?.tags).toEqual(['标签1'])
    expect(pkg?.hook).toBe('引导语内容')
  })

  it('setRecordId 写入 recordId', () => {
    getState().setRecordId('abc-123')
    expect(getState().recordId).toBe('abc-123')
  })

  it('startRewrite 清空 platformPackages 和 recordId', () => {
    useRewriteStore.setState({
      platformPackages: { xiaohongshu: { titles: ['标题1'], tags: ['标签1'], hook: '引导语' } },
      recordId: 'old-record-id',
      status: 'complete',
    })
    getState().startRewrite()
    expect(getState().platformPackages).toEqual({})
    expect(getState().recordId).toBeNull()
  })
})
