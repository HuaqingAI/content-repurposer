/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/features/admin/admin-service', () => ({
  getPlatformConfigs: jest.fn(),
  updatePlatformConfig: jest.fn(),
}))

import { GET, PUT } from '../route'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getPlatformConfigs, updatePlatformConfig } from '@/features/admin/admin-service'

const mockCreateClient = jest.mocked(createClient)
const mockPrismaUserFindUnique = jest.mocked(prisma.user.findUnique)
const mockGetPlatformConfigs = jest.mocked(getPlatformConfigs)
const mockUpdatePlatformConfig = jest.mocked(updatePlatformConfig)

const mockConfigs = [
  {
    id: 'config-1',
    platform: 'xiaohongshu',
    configVersion: 1,
    styleRules: { tone: 'casual' },
    promptTemplate: '你是小红书内容助手...',
    fewShotExamples: [],
    isActive: true,
    updatedAt: new Date('2026-03-01'),
    updatedBy: 'admin-1',
  },
]

/** mock supabase auth */
function mockSupabaseAuth(user: { id: string } | null, authError = false) {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user },
    error: authError ? { message: 'auth error' } : null,
  })
  mockCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
  } as never)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetPlatformConfigs.mockResolvedValue(mockConfigs as never)
  mockUpdatePlatformConfig.mockResolvedValue({
    id: 'config-2',
    platform: 'xiaohongshu',
    configVersion: 2,
    styleRules: {},
    promptTemplate: '新模板',
    fewShotExamples: [],
    isActive: true,
    updatedAt: new Date(),
    updatedBy: 'admin-1',
  } as never)
})

// ── GET /api/admin/platform-configs ───────────────────────────────

describe('GET /api/admin/platform-configs', () => {
  it('未登录返回 401', async () => {
    mockSupabaseAuth(null)
    mockPrismaUserFindUnique.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('认证服务异常返回 503', async () => {
    mockSupabaseAuth(null, true)
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVICE_ERROR')
  })

  it('非 admin 用户返回 403', async () => {
    mockSupabaseAuth({ id: 'user-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'user' } as never)
    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('admin 返回 200 + 平台配置列表', async () => {
    mockSupabaseAuth({ id: 'admin-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'admin' } as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeNull()
    expect(body.data.configs).toHaveLength(1)
    expect(body.data.configs[0].platform).toBe('xiaohongshu')
    expect(mockGetPlatformConfigs).toHaveBeenCalledTimes(1)
  })
})

// ── PUT /api/admin/platform-configs ───────────────────────────────

describe('PUT /api/admin/platform-configs', () => {
  function makeRequest(body: object) {
    return new Request('http://localhost/api/admin/platform-configs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('未登录返回 401', async () => {
    mockSupabaseAuth(null)
    mockPrismaUserFindUnique.mockResolvedValue(null)
    const res = await PUT(
      makeRequest({ platform: 'xiaohongshu', styleRules: {}, promptTemplate: '模板', fewShotExamples: [] })
    )
    expect(res.status).toBe(401)
  })

  it('非 admin 返回 403', async () => {
    mockSupabaseAuth({ id: 'user-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'user' } as never)
    const res = await PUT(
      makeRequest({ platform: 'xiaohongshu', styleRules: {}, promptTemplate: '模板', fewShotExamples: [] })
    )
    expect(res.status).toBe(403)
  })

  it('无效 platform 返回 400', async () => {
    mockSupabaseAuth({ id: 'admin-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'admin' } as never)
    const res = await PUT(
      makeRequest({ platform: 'invalid', styleRules: {}, promptTemplate: '模板', fewShotExamples: [] })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('promptTemplate 为空字符串返回 400', async () => {
    mockSupabaseAuth({ id: 'admin-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'admin' } as never)
    const res = await PUT(
      makeRequest({ platform: 'xiaohongshu', styleRules: {}, promptTemplate: '   ', fewShotExamples: [] })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('admin 保存成功返回 200 + 新版本信息含 updatedAt', async () => {
    mockSupabaseAuth({ id: 'admin-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'admin' } as never)
    const res = await PUT(
      makeRequest({
        platform: 'xiaohongshu',
        styleRules: { tone: 'casual' },
        promptTemplate: '新 prompt 模板',
        fewShotExamples: [],
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeNull()
    expect(body.data.platform).toBe('xiaohongshu')
    expect(body.data.configVersion).toBe(2)
    expect(body.data.updatedAt).toBeDefined()
    expect(mockUpdatePlatformConfig).toHaveBeenCalledWith(
      'xiaohongshu',
      {
        styleRules: { tone: 'casual' },
        promptTemplate: '新 prompt 模板',
        fewShotExamples: [],
      },
      'admin-1'
    )
  })

  it('请求体格式错误返回 400', async () => {
    mockSupabaseAuth({ id: 'admin-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'admin' } as never)
    const req = new Request('http://localhost/api/admin/platform-configs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('body 为 null 时返回 400', async () => {
    mockSupabaseAuth({ id: 'admin-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'admin' } as never)
    const req = new Request('http://localhost/api/admin/platform-configs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('fewShotExamples 为非数组时返回 400', async () => {
    mockSupabaseAuth({ id: 'admin-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'admin' } as never)
    const res = await PUT(
      makeRequest({ platform: 'xiaohongshu', styleRules: {}, promptTemplate: '模板', fewShotExamples: '不是数组' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('styleRules 为数组时返回 400', async () => {
    mockSupabaseAuth({ id: 'admin-1' })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'admin' } as never)
    const res = await PUT(
      makeRequest({ platform: 'xiaohongshu', styleRules: [1, 2, 3], promptTemplate: '模板', fewShotExamples: [] })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
