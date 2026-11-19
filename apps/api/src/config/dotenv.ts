import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadFile(path: string): void {
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

const root = resolve(process.cwd(), '../..')
loadFile(resolve(root, '.env.local'))
loadFile(resolve(root, '.env'))
loadFile(resolve(process.cwd(), '.env'))
