import sqlite3 from 'better-sqlite3'
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator'
import { config } from './config'
import { Bracket, Contestant, PublicBracket } from './types'
import { saveImage } from './image'

// Initialize database
const db = sqlite3(config.dbPath)

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS brackets (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE,
    title TEXT,
    subtitle TEXT,
    isPublic BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS contestants (
    id INTEGER PRIMARY KEY,
    bracket_id INTEGER,
    name TEXT,
    image_url TEXT,
    FOREIGN KEY (bracket_id) REFERENCES brackets(id)
  )
`)

// Get column names for brackets and contestants tables
const bracketCols = db.prepare("PRAGMA table_info(brackets)").all().map((col: any) => col.name)
const contestantCols = db.prepare("PRAGMA table_info(contestants)").all().map((col: any) => col.name)

/* DATABASE MIGRATIONS START */

// Add 'isPublic' column to brackets
if (!bracketCols.includes("isPublic"))
  db.exec("ALTER TABLE brackets ADD COLUMN isPublic BOOLEAN DEFAULT 0")

/* DATABASE MIGRATIONS END */

/**
 * Create a new bracket
 * @param title the title of the bracket
 * @param subtitle the subtitle of the bracket
 * @param contestants the contestants in the bracket
 * @param isPublic whether the bracket is public
 * @param publicCode the public code of the bracket
 * @returns the code of the bracket
 */
export const createBracket = async (title: string, subtitle: string, contestants: Contestant[], isPublic: boolean = false, publicCode?: string): Promise<string> => {
  let code = ''
  if (isPublic && publicCode)
    code = publicCode
  else {
    do {
      // Generate a random code
      code = uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        separator: '-',
        length: 3
      })
      // Keep generating code until it is unique
    } while (db.prepare('SELECT 1 FROM brackets WHERE code = ?').get(code))
  }

  // Insert bracket into database
  const bInsert = db.prepare('INSERT INTO brackets (code, title, subtitle, isPublic) VALUES (?, ?, ?, ?)')
  const bId = bInsert.run(code, title, subtitle, isPublic ? 1 : 0).lastInsertRowid
  
  // Save images for all contestants and update the image_url field
  await Promise.all(contestants.map(async (contestant) => {
    const image_url = await saveImage(contestant, bId)
    if (image_url) contestant.image_url = image_url
  }))

  // Insert contestants into database
  const cInsert = db.prepare('INSERT INTO contestants (bracket_id, name, image_url) VALUES (?, ?, ?)')
  contestants.forEach(contestant => cInsert.run(bId, contestant.name, contestant.image_url))

  return code
}

/**
 * Get a bracket by its code
 * @param code The bracket code
 * @returns The bracket object
 */
export const getBracketByCode = (code: string): Bracket | null => {
  const bracket = db.prepare<string, Bracket>
    ('SELECT id, code, title, subtitle, isPublic FROM brackets WHERE LOWER(code) = LOWER(?)').get(code)
  
  // Return null if bracket not found
  if (!bracket) return null

  const contestants = db.prepare<number, Contestant>
    (`SELECT id, bracket_id, name, image_url FROM contestants WHERE bracket_id = ? order by name`).all(bracket.id)
  
  return { ...bracket, contestants }
}

/**
 * Get all public brackets
 * @returns All public brackets
 */
export const getPublicBrackets = () => db.prepare('SELECT code, title, subtitle FROM brackets WHERE isPublic = 1').all() as PublicBracket[]

/**
 * Check if a bracket code is unique
 * @param code The bracket code
 * @returns Whether the code is unique
 */
export const isCodeUnique = (code: string): boolean => !db.prepare<string, { id: number }>('SELECT id FROM brackets WHERE LOWER(code) = LOWER(?)').get(code)