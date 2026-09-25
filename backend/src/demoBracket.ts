import { Bracket, Contestant } from './types'

const NAMES = [
  'Shasta',
  'Denali',
  'Rainier',
  'Hood',
  'Whitney',
  'Elbert',
  'Blanc',
  'Matterhorn',
  'Everest',
  'Kili',
  'Fuji',
  'Olympus',
  'Logan',
  'Aconcagua',
  'McKinley',
  'Annapurna',
]

/** Built-in 16-goat night so a room can play without SQLite, AI, or image search. */
export function getDemoBracket(code: string): Bracket | null {
  if (code.trim().toLowerCase() !== 'demo') return null

  const contestants: Contestant[] = NAMES.map((name, i) => ({
    id: i + 1,
    bracket_id: 0,
    name,
    image_url: `/demo/c${String(i + 1).padStart(2, '0')}.jpg`,
  }))

  return {
    id: 0,
    code: 'demo',
    title: 'Mountain GOATs',
    subtitle: 'Sixteen goats. One greatest of all time.',
    contestants,
    isPublic: true,
  }
}
