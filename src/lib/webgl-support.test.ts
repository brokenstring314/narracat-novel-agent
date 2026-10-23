// canCreateWebGL2Context 的三种结局：拿到上下文（并立即释放）、拿不到（null）、getContext 自己抛错。
// happy-dom 全局注册必须先于被测模块里对 document 的使用。
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

const { afterAll, afterEach, describe, expect, test } = await import('bun:test')
const { canCreateWebGL2Context } = await import('./webgl-support')

const originalGetContext = HTMLCanvasElement.prototype.getContext

function stubGetContext(impl: (contextId: string) => unknown) {
  HTMLCanvasElement.prototype.getContext = impl as unknown as typeof HTMLCanvasElement.prototype.getContext
}

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
})

afterAll(async () => {
  await GlobalRegistrator.unregister()
})

describe('canCreateWebGL2Context', () => {
  test('拿到 webgl2 上下文时返回 true，并立即释放探测用的上下文', () => {
    const requested: string[] = []
    let lost = 0
    stubGetContext((contextId) => {
      requested.push(contextId)
      return { getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext: () => { lost += 1 } } : null) }
    })
    expect(canCreateWebGL2Context()).toBe(true)
    // three.js 只支持 WebGL2：探测 webgl1 拿到也不算数
    expect(requested).toEqual(['webgl2'])
    expect(lost).toBe(1)
  })

  test('无 GPU 加速时 getContext 返回 null → false', () => {
    stubGetContext(() => null)
    expect(canCreateWebGL2Context()).toBe(false)
  })

  test('getContext 本身抛错 → false，不向外抛', () => {
    stubGetContext(() => {
      throw new Error('context creation blocked')
    })
    expect(canCreateWebGL2Context()).toBe(false)
  })
})
