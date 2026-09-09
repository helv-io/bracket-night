import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, Texture } from 'three'

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
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = 'bold 84px Outfit, sans-serif'
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

const loadToCanvas = (url: string): Promise<Texture> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('no 2d context'))
        return
      }
      ctx.drawImage(img, 0, 0, 512, 512)
      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      texture.needsUpdate = true
      resolve(texture)
    }
    img.onerror = () => reject(new Error(`image failed: ${url}`))
    img.src = url
  })

export const useNightTexture = (url: string | undefined, label: string): Texture | null => {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    const key = url || `fallback:${label}`
    const hit = cache.get(key)
    if (hit) {
      setTexture(hit)
      return
    }
    const generated = fallback(label)
    setTexture(generated)
    if (!url) {
      cache.set(key, generated)
      return
    }
    let cancelled = false
    loadToCanvas(url)
      .then(loaded => {
        if (cancelled) return
        cache.set(key, loaded)
        setTexture(loaded)
      })
      .catch(() => {
        if (cancelled) return
        cache.set(key, generated)
      })
    return () => {
      cancelled = true
    }
  }, [url, label])

  return texture
}
