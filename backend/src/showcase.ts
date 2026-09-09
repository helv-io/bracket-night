import { Bracket, Contestant } from './types'

/** Reserved template code. In-memory house field, no SQLite. */
export const SHOWCASE_CODE = 'showcase'

const FACES: Array<{ name: string; hue: number }> = [
  { name: 'Neon Fox', hue: 18 },
  { name: 'Gold Finch', hue: 44 },
  { name: 'Indigo Ray', hue: 230 },
  { name: 'Coral Drum', hue: 8 },
  { name: 'Sage Volt', hue: 140 },
  { name: 'Violet Kick', hue: 275 },
  { name: 'Amber Tide', hue: 32 },
  { name: 'Ice Comet', hue: 200 },
]

function placeholderImage(name: string, hue: number): string {
  const initial = name.slice(0, 1).toUpperCase()
  const safe = name.replace(/[<>&]/g, '')
  const bg = `hsl(${hue}, 62%, 38%)`
  const fg = '#ffe9a8'
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#0b1020"/>` +
    `</linearGradient></defs>` +
    `<rect width="512" height="512" fill="url(#g)"/>` +
    `<circle cx="256" cy="220" r="110" fill="rgba(232,196,106,0.22)" stroke="#e8c46a" stroke-width="8"/>` +
    `<text x="256" y="250" text-anchor="middle" font-size="140" font-family="Impact, sans-serif" fill="${fg}">${initial}</text>` +
    `<text x="256" y="420" text-anchor="middle" font-size="36" font-family="sans-serif" fill="${fg}">${safe}</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function getShowcaseBracket(): Bracket {
  const contestants: Contestant[] = FACES.map((face, i) => ({
    id: i + 1,
    bracket_id: 0,
    name: face.name,
    image_url: placeholderImage(face.name, face.hue),
  }))

  return {
    id: 0,
    code: SHOWCASE_CODE,
    title: 'House Showcase',
    subtitle: 'Eight faces. One night. The room decides.',
    contestants,
    isPublic: true,
  }
}
