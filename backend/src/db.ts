import sqlite3 from 'better-sqlite3'
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator'
import { config } from './config'

const db = sqlite3(config.dbPath)

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS brackets (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE,
    title TEXT,
    subtitle TEXT,
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

// Create a new bracket with 16 contestants
export function createBracket(title: string, subtitle: string, contestants: { name: string, image_url: string }[]): string {
  let code: string
  do {
    code = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: '-',
      length: 3
    })
  } while (db.prepare('SELECT 1 FROM brackets WHERE code = ?').get(code))

  const bracketInsert = db.prepare('INSERT INTO brackets (code, title, subtitle) VALUES (?, ?, ?)')
  const bracketId = bracketInsert.run(code, title, subtitle).lastInsertRowid

  const contestantInsert = db.prepare('INSERT INTO contestants (bracket_id, name, image_url) VALUES (?, ?, ?)')
  contestants.forEach(contestant => contestantInsert.run(bracketId, contestant.name, contestant.image_url))

  return code
}

// Retrieve a bracket by its code
export function getBracketByCode(code: string):
  { id: number, title: string, subtitle: string, contestants: { id: number, name: string, image_url: string }[] }
  | null {
  const bracket = db.prepare<string, { id: number, title: string, subtitle: string }>
    ('SELECT id, title, subtitle FROM brackets WHERE code = ?').get(code)
  
  // Return null if bracket not found
  if (!bracket) return null

  const contestants = db.prepare<number, { id: number, name: string, image_url: string }>
    ('SELECT id, name, image_url FROM contestants WHERE bracket_id = ?').all(bracket.id)
  
  return { ...bracket, contestants }
}