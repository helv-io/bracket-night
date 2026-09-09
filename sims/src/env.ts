import fs from 'fs'
import os from 'os'
import path from 'path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bn-sim-'))
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.DB_FOLDER = process.env.DB_FOLDER || tmp
process.env.DB_PATH = process.env.DB_PATH || path.join(tmp, 'bracket.db')
process.env.DATA_PATH = process.env.DATA_PATH || path.join(tmp, 'data')
process.env.NIGHT_DEV_CODE = process.env.NIGHT_DEV_CODE || '0'
