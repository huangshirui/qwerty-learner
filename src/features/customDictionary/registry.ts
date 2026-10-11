import type { Dictionary } from '@/typings'
import { CUSTOM_DICTIONARY_STORAGE_KEY } from './storage'

export function loadCustomDictionaryMetadata(): Dictionary[] {
  try {
    const raw = localStorage.getItem(CUSTOM_DICTIONARY_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const value = JSON.parse(raw)
    return Array.isArray(value) ? (value as Dictionary[]) : []
  } catch (error) {
    console.error('Failed to load custom dictionary metadata:', error)
    return []
  }
}

export const initialCustomDictionaries = loadCustomDictionaryMetadata()
