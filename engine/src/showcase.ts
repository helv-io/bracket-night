import { Field } from './types'
import { createContestantId } from './ids'

const NAMES = [
  'Neon Nachos',
  'Midnight Espresso',
  'Velvet Thunder',
  'Golden Hour',
  'Pixel Dragon',
  'Cosmic Bagel',
  'Thunder Pickle',
  'Neon Narwhal',
]

/** Built-in 8-contestant house field. Photos live in frontend/public/showcase. */
export const showcaseField = (): Field => ({
  title: 'House Showcase',
  subtitle: 'The house field. Eight fighters, one champion.',
  source: 'showcase',
  code: 'showcase',
  contestants: NAMES.map((name, i) => ({
    id: createContestantId(i + 1),
    name,
    imageUrl: `/showcase/${String(i + 1).padStart(2, '0')}.jpg`,
  })),
})

export const inlineField = (
  title: string,
  subtitle: string,
  names: string[]
): Field => ({
  title,
  subtitle,
  source: 'inline',
  contestants: names.map((name, i) => ({
    id: createContestantId(i + 1),
    name,
    imageUrl: '',
  })),
})
