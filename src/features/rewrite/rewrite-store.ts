import { create } from 'zustand'
import type { Platform } from './platform-selector'
import type { Tone } from './tone-selector'

export type RewriteStatus = 'idle' | 'rewriting' | 'complete'

export interface ContentPackage {
  titles?: string[]
  tags?: string[]
  hook?: string
}

interface RewriteState {
  text: string
  platforms: Platform[]
  tone: Tone
  status: RewriteStatus
  streamingTexts: Partial<Record<Platform, string>>
  /** 用户当前查看的 tab */
  activeTab: Platform | null
  /** 正在流式输出的平台（用于 chunk 路由和 isStreaming 判断） */
  streamingPlatform: Platform | null
  streamError: string | null
  platformPackages: Partial<Record<Platform, ContentPackage>>
  recordId: string | null
  resultIds: Partial<Record<Platform, string>>
}

interface RewriteActions {
  setText: (text: string) => void
  setPlatforms: (platforms: Platform[]) => void
  setTone: (tone: Tone) => void
  setActiveTab: (platform: Platform) => void
  startRewrite: () => void
  onPlatformStart: (platform: Platform) => void
  appendChunk: (platform: Platform, chunk: string) => void
  setStreamError: (error: string) => void
  completeRewrite: () => void
  setTitles: (platform: Platform, titles: string[]) => void
  setTags: (platform: Platform, tags: string[]) => void
  setHook: (platform: Platform, hook: string) => void
  setRecordId: (recordId: string) => void
  setResultId: (platform: Platform, resultId: string) => void
}

const initialInputState = {
  text: '',
  platforms: [] as Platform[],
  tone: 'standard' as Tone,
}

const initialStreamState = {
  status: 'idle' as RewriteStatus,
  streamingTexts: {} as Partial<Record<Platform, string>>,
  activeTab: null as Platform | null,
  streamingPlatform: null as Platform | null,
  streamError: null as string | null,
  platformPackages: {} as Partial<Record<Platform, ContentPackage>>,
  recordId: null as string | null,
  resultIds: {} as Partial<Record<Platform, string>>,
}

export const useRewriteStore = create<RewriteState & RewriteActions>((set) => ({
  ...initialInputState,
  ...initialStreamState,

  setText: (text) => set({ text }),

  setPlatforms: (platforms) =>
    set((state) => ({
      platforms,
      // 修复 deferred bug：平台变更后若已完成，重置为 idle 使按钮文案更新
      status: state.status === 'complete' ? 'idle' : state.status,
    })),

  setTone: (tone) =>
    set((state) => ({
      tone,
      // 修复 deferred bug：语气变更后若已完成，重置为 idle 使按钮文案更新
      status: state.status === 'complete' ? 'idle' : state.status,
    })),

  setActiveTab: (platform) => set({ activeTab: platform }),

  startRewrite: () =>
    set({
      status: 'rewriting',
      streamingTexts: {},
      activeTab: null,
      streamingPlatform: null,
      streamError: null,
      platformPackages: {},
      recordId: null,
      resultIds: {},
    }),

  onPlatformStart: (platform) =>
    set({
      activeTab: platform,
      streamingPlatform: platform,
    }),

  appendChunk: (platform, chunk) =>
    set((state) => ({
      streamingTexts: {
        ...state.streamingTexts,
        [platform]: (state.streamingTexts[platform] ?? '') + chunk,
      },
    })),

  setStreamError: (error) =>
    set({
      streamError: error,
      status: 'idle',
      streamingPlatform: null,
    }),

  completeRewrite: () =>
    set({
      status: 'complete',
      streamingPlatform: null,
    }),

  setTitles: (platform, titles) =>
    set((state) => ({
      platformPackages: {
        ...state.platformPackages,
        [platform]: { ...state.platformPackages[platform], titles },
      },
    })),

  setTags: (platform, tags) =>
    set((state) => ({
      platformPackages: {
        ...state.platformPackages,
        [platform]: { ...state.platformPackages[platform], tags },
      },
    })),

  setHook: (platform, hook) =>
    set((state) => ({
      platformPackages: {
        ...state.platformPackages,
        [platform]: { ...state.platformPackages[platform], hook },
      },
    })),

  setRecordId: (recordId) => set({ recordId }),

  setResultId: (platform, resultId) =>
    set((state) => ({
      resultIds: { ...state.resultIds, [platform]: resultId },
    })),
}))
