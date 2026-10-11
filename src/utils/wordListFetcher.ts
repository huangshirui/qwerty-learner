import { getCustomDictionaryWords, isCustomDictionaryUrl } from '@/features/customDictionary/storage'
import type { Word } from '@/typings'

export async function wordListFetcher(url: string): Promise<Word[]> {
  if (isCustomDictionaryUrl(url)) {
    return getCustomDictionaryWords(url)
  }

  const URL_PREFIX: string = REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''

  const response = await fetch(URL_PREFIX + url)
  const words: Word[] = await response.json()
  return words
}
