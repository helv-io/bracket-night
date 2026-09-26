import { useEffect, useRef } from 'react'
import {
  GoldCluster,
  SKY_DRIFT,
  StarLayer,
  StarTint,
  TILE_H,
  TILE_W,
  buildConstellationField,
  buildGoldCluster,
} from '../lib/constellationField'

const TINT_RGB: Record<StarTint, readonly [number, number, number]> = {
  white: [236, 242, 255],
  cool: [186, 206, 255],
  warm: [255, 214, 150],
}

/** Cap the backing store so a 4K TV does not allocate a huge bitmap. */
function backingScale(cssW: number, cssH: number): number {
  const native = Math.min(window.devicePixelRatio || 1, 2)
  const maxPixels = 8_500_000
  let dpr = native
  const area = Math.max(1, cssW * cssH)
  while (area * dpr * dpr > maxPixels && dpr > 1) {
    dpr = Math.max(1, Math.round((dpr - 0.25) * 100) / 100)
  }
  return dpr
}

function makeSprite(rgb: readonly [number, number, number]): HTMLCanvasElement {
  const size = 64
  const sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size
  const ctx = sprite.getContext('2d')
  if (!ctx) return sprite
  const c = size / 2
  const [r, g, b] = rgb
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c)
  glow.addColorStop(0, `rgba(${r},${g},${b},1)`)
  glow.addColorStop(0.1, `rgba(${r},${g},${b},0.95)`)
  glow.addColorStop(0.22, `rgba(${r},${g},${b},0.32)`)
  glow.addColorStop(0.5, `rgba(${r},${g},${b},0.07)`)
  glow.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)
  return sprite
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const vertical = ctx.createLinearGradient(0, 0, 0, h)
  vertical.addColorStop(0, '#12182e')
  vertical.addColorStop(0.5, '#0b1020')
  vertical.addColorStop(1, '#070a14')
  ctx.fillStyle = vertical
  ctx.fillRect(0, 0, w, h)

  const indigo = ctx.createRadialGradient(w * 0.4, h * 0.08, 0, w * 0.4, h * 0.08, Math.max(w, h) * 0.72)
  indigo.addColorStop(0, 'rgba(86, 116, 196, 0.16)')
  indigo.addColorStop(1, 'rgba(86, 116, 196, 0)')
  ctx.fillStyle = indigo
  ctx.fillRect(0, 0, w, h)
}

function paintLayer(
  ctx: CanvasRenderingContext2D,
  layer: StarLayer,
  sprites: Record<StarTint, HTMLCanvasElement>,
  scrollX: number,
  scrollY: number,
  time: number,
  viewW: number,
  viewH: number,
): void {
  const ox = mod(scrollX, TILE_W)
  const oy = mod(scrollY, TILE_H)

  ctx.globalAlpha = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let y = -oy; y < viewH; y += TILE_H) {
    for (let x = -ox; x < viewW; x += TILE_W) {
      for (const edge of layer.edges) {
        const x1 = x + edge.x1
        const y1 = y + edge.y1
        const x2 = x + edge.x2
        const y2 = y + edge.y2
        const off =
          (x1 < -8 && x2 < -8) ||
          (y1 < -8 && y2 < -8) ||
          (x1 > viewW + 8 && x2 > viewW + 8) ||
          (y1 > viewH + 8 && y2 > viewH + 8)
        if (off) continue
        ctx.strokeStyle = edge.warm
          ? `rgba(216, 178, 112, ${edge.a})`
          : `rgba(188, 208, 236, ${edge.a})`
        ctx.lineWidth = edge.width
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      for (const star of layer.stars) {
        const sx = x + star.x
        const sy = y + star.y
        const size = Math.max(3.2, star.r * 9)
        if (sx < -size || sy < -size || sx > viewW + size || sy > viewH + size) continue
        const wave = Math.sin(time * star.speed + star.phase)
        ctx.globalAlpha = Math.max(0, Math.min(1, star.a * (1 + star.twinkle * wave)))
        ctx.drawImage(sprites[star.tint], sx - size / 2, sy - size / 2, size, size)
      }
    }
  }
  ctx.globalAlpha = 1
}

function paintGold(
  ctx: CanvasRenderingContext2D,
  gold: GoldCluster,
  sprites: Record<StarTint, HTMLCanvasElement>,
  w: number,
  h: number,
  time: number,
): void {
  const reach = Math.min(176, Math.max(78, Math.min(w, h) * 0.2))
  const wobbleX = Math.sin(time * 0.08) * Math.min(16, reach * 0.1)
  const wobbleY = Math.sin(time * 0.055) * Math.min(12, reach * 0.08)
  const cx = w - reach * 0.95 + wobbleX
  const cy = h * 0.38 + wobbleY

  const glowR = reach * 2.15
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
  glow.addColorStop(0, 'rgba(255, 198, 120, 0.2)')
  glow.addColorStop(0.28, 'rgba(210, 150, 70, 0.09)')
  glow.addColorStop(0.6, 'rgba(150, 100, 48, 0.035)')
  glow.addColorStop(1, 'rgba(150, 100, 48, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2)

  const at = (index: number) => {
    const star = gold.stars[index]
    if (!star) return null
    return {
      x: cx + star.ux * reach,
      y: cy + star.uy * reach * 0.78,
    }
  }

  ctx.lineCap = 'round'
  ctx.lineWidth = 1
  for (const edge of gold.edges) {
    const p = at(edge.a)
    const q = at(edge.b)
    if (!p || !q) continue
    ctx.strokeStyle = `rgba(226, 186, 120, ${edge.alpha})`
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }

  for (const star of gold.stars) {
    const sx = cx + star.ux * reach
    const sy = cy + star.uy * reach * 0.78
    const size = Math.max(3.2, star.r * 9)
    const wave = Math.sin(time * star.speed + star.phase)
    ctx.globalAlpha = Math.max(0, Math.min(1, star.a * (1 + star.twinkle * wave)))
    ctx.drawImage(sprites[star.tint], sx - size / 2, sy - size / 2, size, size)
  }
  ctx.globalAlpha = 1
}

/**
 * Full-bleed night sky behind the host / bracket TV.
 * One canvas, one animation loop, paused while the tab is hidden.
 * `prefers-reduced-motion: reduce` paints a single frozen frame.
 */
export default function ConstellationBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const field = buildConstellationField()
    const gold = buildGoldCluster()
    const sprites: Record<StarTint, HTMLCanvasElement> = {
      white: makeSprite(TINT_RGB.white),
      cool: makeSprite(TINT_RGB.cool),
      warm: makeSprite(TINT_RGB.warm),
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = motion.matches
    let running = false
    let raf = 0
    let time = 0
    let lastPaint = 0
    let viewW = 0
    let viewH = 0

    const draw = (t: number) => {
      if (viewW < 2 || viewH < 2) return
      paintSky(ctx, viewW, viewH)
      paintLayer(
        ctx,
        field.far,
        sprites,
        t * SKY_DRIFT.farX + 420,
        t * SKY_DRIFT.farY + 160,
        t,
        viewW,
        viewH,
      )
      paintLayer(
        ctx,
        field.near,
        sprites,
        t * SKY_DRIFT.nearX,
        t * SKY_DRIFT.nearY,
        t,
        viewW,
        viewH,
      )
      paintGold(ctx, gold, sprites, viewW, viewH, reduced ? 0 : t)
    }

    const fit = () => {
      const rect = canvas.getBoundingClientRect()
      viewW = rect.width
      viewH = rect.height
      if (viewW < 2 || viewH < 2) return
      const dpr = backingScale(viewW, viewH)
      const nextW = Math.max(1, Math.round(viewW * dpr))
      const nextH = Math.max(1, Math.round(viewH * dpr))
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW
        canvas.height = nextH
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(reduced ? 0 : time)
    }

    const stop = () => {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    const loop = (now: number) => {
      if (!running) return
      raf = requestAnimationFrame(loop)
      if (now - lastPaint < 32) return
      const dt = lastPaint === 0 ? 0 : Math.min(0.05, (now - lastPaint) / 1000)
      lastPaint = now
      time += dt
      draw(time)
    }

    const start = () => {
      if (running || reduced || document.hidden) return
      running = true
      lastPaint = 0
      raf = requestAnimationFrame(loop)
    }

    const onMotion = () => {
      reduced = motion.matches
      if (reduced) {
        stop()
        time = 0
        draw(0)
        return
      }
      start()
    }

    const onVisibility = () => {
      if (document.hidden) {
        stop()
        return
      }
      start()
    }

    fit()
    start()

    const observer = new ResizeObserver(() => fit())
    observer.observe(canvas)
    motion.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      observer.disconnect()
      motion.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvasRef} className="constellation-backdrop" aria-hidden="true" />
}
