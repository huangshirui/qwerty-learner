import type { Word } from '@/typings'
import Dexie from 'dexie'
import type { Table } from 'dexie'

export const CUSTOM_DICTIONARY_STORAGE_KEY = 'customDictionaries'
export const CUSTOM_DICTIONARY_URL_PREFIX = 'custom://'

type CustomDictionaryWordList = {
  id: string
  words: Word[]
}

class CustomDictionaryDB extends Dexie {
  wordLists!: Table<CustomDictionaryWordList, string>

  constructor() {
    super('CustomDictionaryDB')
    this.version(1).stores({
      wordLists: 'id',
    })
  }
}

const db = new CustomDictionaryDB()

export function createCustomDictionaryId() {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `custom-${uuid}`
}

export function createCustomDictionaryUrl(id: string) {
  return `${CUSTOM_DICTIONARY_URL_PREFIX}${id}`
}

export function isCustomDictionaryUrl(url: string) {
  return url.startsWith(CUSTOM_DICTIONARY_URL_PREFIX)
}

export async function saveCustomDictionaryWords(id: string, words: Word[]) {
  await db.wordLists.put({ id, words })
}

export async function getCustomDictionaryWords(url: string): Promise<Word[]> {
  const id = url.slice(CUSTOM_DICTIONARY_URL_PREFIX.length)
  const record = await db.wordLists.get(id)

  if (!record) {
    throw new Error(`Custom dictionary data not found: ${id}`)
  }

  return record.words
}

export async function deleteCustomDictionaryWords(id: string) {
  await db.wordLists.delete(id)
}
