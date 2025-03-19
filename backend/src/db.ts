import sqlite3 from 'better-sqlite3'
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator'
import { config } from './config'
import { Bracket, Contestant } from 'types'

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

// Add 'internal_url' column to contestants
if (!contestantCols.includes("internal_url"))
  db.exec("ALTER TABLE contestants ADD COLUMN internal_url TEXT")

/* DATABASE MIGRATIONS END */

// Create a new bracket with 16 contestants
export const createBracket = (title: string, subtitle: string, contestants: Contestant[], isPublic: boolean = false, code?: string): string => {
  let bCode: string = code || ''
  if (!isPublic) {
    do {
      code = uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        separator: '-',
        length: 3
      })
    } while (db.prepare('SELECT 1 FROM brackets WHERE code = ?').get(bCode))
  }

  const bracketInsert = db.prepare('INSERT INTO brackets (code, title, subtitle, isPublic) VALUES (?, ?, ?, ?)')
  const bracketId = bracketInsert.run(code, title, subtitle, isPublic ? 1 : 0).lastInsertRowid

  const contestantInsert = db.prepare('INSERT INTO contestants (bracket_id, name, image_url, internal_url) VALUES (?, ?, ?)')
  contestants.forEach(contestant => contestantInsert.run(bracketId, contestant.name, contestant.image_url, contestant.image_url))

  return bCode
}

// Retrieve a bracket by its code
export const getBracketByCode = (code: string): Bracket | null => {
  const bracket = db.prepare<string, Bracket>
    ('SELECT id, code, title, subtitle, isPublic FROM brackets WHERE LOWER(code) = LOWER(?)').get(code)
  
  // Return null if bracket not found
  if (!bracket) return null

  const contestants = db.prepare<number, Contestant>
    (`SELECT id, bracket_id, name, image_url, internal_url FROM contestants WHERE bracket_id = ?`).all(bracket.id)
  
  return { ...bracket, contestants }
}

// Retrieve all public brackets
export const getPublicBrackets = () => {
  return db.prepare('SELECT code, title, subtitle FROM brackets WHERE isPublic = 1').all()
}

// Check if a bracket code is unique
export const isCodeUnique = (code: string): boolean => {
  const bracket = db.prepare<string, { id: number }>('SELECT id FROM brackets WHERE LOWER(code) = LOWER(?)').get(code)
  return !bracket
}