// 无 WebGL 环境（--disable-gpu、GPU 被驱动黑名单拉黑、远程桌面、部分 Linux 虚拟机）的真实 DOM 回归：
// 首启介绍页的三个 ogl 装饰动效在 canvas.getContext 拿不到上下文时，必须安静地不画，
// 不能把异常抛进 React——渲染进程里没有任何边界接住它，抛出即卸载整个 #root、整窗白屏，
// 而 introVersion 只在看完/跳过时回写，下次启动又停在同一屏。
//
// happy-dom 全局注册必须先于 @testing-library/react 的加载；查询一律用 container，不用 screen。
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

const { afterAll, afterEach, beforeEach, describe, expect, test } = await import('bun:test')
const { act, cleanup, render } = await import('@testing-library/react')
const { Threads } = await import('./Threads')
const { TextParticles } = await import('./TextParticles')
const { CircularGallery } = await import('./CircularGallery')

const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
let getContextCalls: string[] = []

beforeEach(() => {
  getContextCalls = []
  // 模拟无 WebGL：浏览器在 GPU 不可用时 getContext('webgl2'/'webgl') 返回 null（不抛错）
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, contextId: string) {
    getContextCalls.push(contextId)
    return null
  } as typeof HTMLCanvasElement.prototype.getContext
  // ogl 拿不到上下文时会先 console.error 一行；降级路径会 console.warn 一行。都是预期输出，静音。
  console.error = () => {}
  console.warn = () => {}
})

afterEach(() => {
  cleanup()
  HTMLCanvasElement.prototype.getContext = originalGetContext
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

afterAll(async () => {
  await GlobalRegistrator.unregister()
})

describe('首启介绍页 ogl 动效（无 WebGL）', () => {
  test('Threads：拿不到 WebGL 上下文时不抛错、不挂 canvas，容器照常渲染', () => {
    let view: ReturnType<typeof render> | undefined
    expect(() => {
      act(() => {
        view = render(<Threads className="threads-slot" />)
      })
    }).not.toThrow()
    expect(getContextCalls.length).toBeGreaterThan(0)
    const slot = view!.container.querySelector('.threads-slot')
    expect(slot).not.toBeNull()
    expect(slot!.querySelector('canvas')).toBeNull()
  })

  test('TextParticles：拿不到 WebGL 上下文时不抛错、不挂 canvas', () => {
    let view: ReturnType<typeof render> | undefined
    expect(() => {
      act(() => {
        view = render(<TextParticles className="particles-slot" />)
      })
    }).not.toThrow()
    expect(getContextCalls.length).toBeGreaterThan(0)
    const slot = view!.container.querySelector('.particles-slot')
    expect(slot).not.toBeNull()
    expect(slot!.querySelector('canvas')).toBeNull()
  })

  test('CircularGallery：拿不到 WebGL 上下文时不抛错、卸载也不抛错', () => {
    let view: ReturnType<typeof render> | undefined
    expect(() => {
      act(() => {
        view = render(<CircularGallery items={[{ image: 'data:image/png;base64,', text: '苏见' }]} />)
      })
    }).not.toThrow()
    expect(getContextCalls.length).toBeGreaterThan(0)
    const region = view!.container.querySelector('[role="region"]')
    expect(region).not.toBeNull()
    expect(region!.querySelector('canvas')).toBeNull()
    expect(() => view!.unmount()).not.toThrow()
  })
})
