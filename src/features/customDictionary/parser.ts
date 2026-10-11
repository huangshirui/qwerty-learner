import type { Word } from '@/typings'

export type ParsedCustomDictionary = {
  name: string
  words: Word[]
}

type RawWord = {
  name?: unknown
  word?: unknown
  trans?: unknown
  translation?: unknown
  meaning?: unknown
  usphone?: unknown
  ukphone?: unknown
  notation?: unknown
}

function normalizeTranslations(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (value === null || value === undefined) {
    return []
  }

  const text = String(value).trim()
  return text ? [text] : []
}

function normalizeWord(raw: RawWord, rowNumber: number): Word {
  const nameValue = raw.name ?? raw.word
  const name = typeof nameValue === 'string' ? nameValue.trim() : ''

  if (!name) {
    throw new Error(`第 ${rowNumber} 条缺少单词字段 name/word`)
  }

  const trans = normalizeTranslations(raw.trans ?? raw.translation ?? raw.meaning)

  return {
    name,
    trans,
    usphone: typeof raw.usphone === 'string' ? raw.usphone.trim() : '',
    ukphone: typeof raw.ukphone === 'string' ? raw.ukphone.trim() : '',
    notation: typeof raw.notation === 'string' ? raw.notation.trim() : undefined,
  }
}

function parseJson(text: string): Word[] {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('JSON 格式无法解析，请检查文件内容')
  }

  const rows = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && Array.isArray((value as { words?: unknown }).words)
      ? (value as { words: unknown[] }).words
      : null

  if (!rows) {
    throw new Error('JSON 顶层需要是词条数组，或包含 words 数组')
  }

  return rows.map((row, index) => {
    if (typeof row === 'string') {
      return normalizeWord({ name: row }, index + 1)
    }
    if (typeof row !== 'object' || row === null) {
      throw new Error(`第 ${index + 1} 条不是有效词条`)
    }
    return normalizeWord(row as RawWord, index + 1)
  })
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === ',' && !quoted) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1
      }
      row.push(field)
      if (row.some((item) => item.trim())) {
        rows.push(row)
      }
      row = []
      field = ''
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((item) => item.trim())) {
    rows.push(row)
  }

  if (quoted) {
    throw new Error('CSV 中存在未闭合的引号')
  }

  return rows
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(header))
}

function parseCsv(text: string): Word[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''))
  if (rows.length === 0) {
    return []
  }

  const normalizedHeaders = rows[0].map((header) => header.trim().toLowerCase())
  const nameIndex = findHeaderIndex(normalizedHeaders, ['name', 'word', '单词'])
  const transIndex = findHeaderIndex(normalizedHeaders, ['trans', 'translation', 'meaning', '释义', '翻译'])
  const usphoneIndex = findHeaderIndex(normalizedHeaders, ['usphone', 'us', '美式音标'])
  const ukphoneIndex = findHeaderIndex(normalizedHeaders, ['ukphone', 'uk', '英式音标'])
  const hasHeader = nameIndex >= 0 || transIndex >= 0
  const startIndex = hasHeader ? 1 : 0
  const resolvedNameIndex = nameIndex >= 0 ? nameIndex : 0
  const resolvedTransIndex = transIndex >= 0 ? transIndex : 1

  return rows.slice(startIndex).map((columns, index) =>
    normalizeWord(
      {
        name: columns[resolvedNameIndex],
        trans: columns[resolvedTransIndex],
        usphone: usphoneIndex >= 0 ? columns[usphoneIndex] : '',
        ukphone: ukphoneIndex >= 0 ? columns[ukphoneIndex] : '',
      },
      index + startIndex + 1,
    ),
  )
}

export async function parseCustomDictionaryFile(file: File): Promise<ParsedCustomDictionary> {
  const text = await file.text()
  const extension = file.name.split('.').pop()?.toLowerCase()
  const name = file.name.replace(/\.[^.]+$/, '') || '自定义词库'

  let words: Word[]
  if (extension === 'json') {
    words = parseJson(text)
  } else if (extension === 'csv') {
    words = parseCsv(text)
  } else {
    throw new Error('目前仅支持 .json 和 .csv 文件')
  }

  const validWords = words.filter((word) => word.name.length > 0)
  if (validWords.length === 0) {
    throw new Error('文件中没有可导入的词条')
  }

  return { name, words: validWords }
}
