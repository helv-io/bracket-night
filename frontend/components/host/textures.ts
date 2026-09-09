import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { Contestant } from '../../../backend/src/types'

function paintFallback(ctx: CanvasRenderingContext2D, label: string) {
  const { width, height } = ctx.canvas
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, '#1a2a55')
  grad.addColorStop(1, '#0b1020')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#e8c46a'
  ctx.lineWidth = 18
  ctx.beginPath()
  ctx.arc(width / 2, height * 0.42, width * 0.22, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ffe9a8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.floor(width * 0.28)}px Impact, sans-serif`
  ctx.fillText((label || '?').slice(0, 1).toUpperCase(), width / 2, height * 0.44)
  ctx.font = `600 ${Math.floor(width * 0.07)}px sans-serif`
  ctx.fillText((label || 'TBD').slice(0, 18), width / 2, height * 0.82)
}

export function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export function fallbackTexture(label: string): THREE.CanvasTexture {
  return canvasTexture((ctx) => paintFallback(ctx, label))
}

export function useContestantTexture(contestant: Contestant | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    let disposed = false
    let loaded: THREE.Texture | null = null
    const label = contestant?.name || 'TBD'
    const url = contestant?.image_url

    const apply = (tex: THREE.Texture) => {
      if (disposed) {
        tex.dispose()
        return
      }
      loaded = tex
      setTexture(tex)
    }

    if (!url) {
      apply(fallbackTexture(label))
      return () => {
        disposed = true
        loaded?.dispose()
      }
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const tex = canvasTexture((ctx) => {
        ctx.fillStyle = '#0b1020'
        ctx.fillRect(0, 0, 512, 512)
        const side = Math.min(image.width, image.height)
        const sx = (image.width - side) / 2
        const sy = (image.height - side) / 2
        ctx.drawImage(image, sx, sy, side, side, 0, 0, 512, 512)
      })
      apply(tex)
    }
    image.onerror = () => apply(fallbackTexture(label))
    image.src = url

    return () => {
      disposed = true
      loaded?.dispose()
    }
  }, [contestant?.id, contestant?.image_url, contestant?.name])

  return texture
}

export function useTextureFromCanvas(canvas: HTMLCanvasElement | null): THREE.CanvasTexture | null {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    if (!canvas) {
      setTexture(null)
      return
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    setTexture(tex)
    return () => {
      tex.dispose()
    }
  }, [canvas])

  return texture
}
