import { useEffect, useState } from 'react'
import { Texture, TextureLoader, SRGBColorSpace, CanvasTexture } from 'three'

const loader = new TextureLoader()
const cache = new Map<string, Texture>()

const fallback = (label: string): Texture => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const hue = Math.abs(hash(label)) % 360
    const g = ctx.createLinearGradient(0, 0, 512, 512)
    g.addColorStop(0, `hsl(${hue} 70% 45%)`)
    g.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 18%)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 72px Outfit, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label.slice(0, 2).toUpperCase(), 256, 256)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const hash = (value: string): number => {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return h
}

export const useNightTexture = (url: string | undefined, label: string): Texture | null => {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    const key = url || `fallback:${label}`
    const hit = cache.get(key)
    if (hit) {
      setTexture(hit)
      return
    }
    if (!url) {
      const generated = fallback(label)
      cache.set(key, generated)
      setTexture(generated)
      return
    }
    let cancelled = false
    loader.load(
      url,
      loaded => {
        if (cancelled) return
        loaded.colorSpace = SRGBColorSpace
        cache.set(key, loaded)
        setTexture(loaded)
      },
      undefined,
      () => {
        if (cancelled) return
        const generated = fallback(label)
        cache.set(key, generated)
        setTexture(generated)
      }
    )
    return () => {
      cancelled = true
    }
  }, [url, label])

  return texture
}
