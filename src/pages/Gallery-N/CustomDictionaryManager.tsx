import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { registerCustomDictionary, unregisterCustomDictionary } from '@/features/customDictionary/registry'
import { parseCustomDictionaryFile } from '@/features/customDictionary/parser'
import {
  createCustomDictionaryId,
  createCustomDictionaryUrl,
  deleteCustomDictionaryWords,
  saveCustomDictionaryWords,
} from '@/features/customDictionary/storage'
import { currentChapterAtom, currentDictIdAtom, customDictionariesAtom } from '@/store'
import type { Dictionary, Word } from '@/typings'
import { calcChapterCount } from '@/utils'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useRef, useState } from 'react'
import IconUpload from '~icons/tabler/upload'
import IconTrash from '~icons/weui/delete-filled'

type PendingImport = {
  fileName: string
  name: string
  words: Word[]
}

export default function CustomDictionaryManager() {
  const [customDictionaries, setCustomDictionaries] = useAtom(customDictionariesAtom)
  const currentDictId = useAtomValue(currentDictIdAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [dictionaryName, setDictionaryName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const resetPendingImport = useCallback(() => {
    setPendingImport(null)
    setDictionaryName('')
    setErrorMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const onSelectFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setErrorMessage('')
    try {
      const parsed = await parseCustomDictionaryFile(file)
      setPendingImport({ fileName: file.name, name: parsed.name, words: parsed.words })
      setDictionaryName(parsed.name)
    } catch (error) {
      setPendingImport(null)
      setDictionaryName('')
      setErrorMessage(error instanceof Error ? error.message : '词库解析失败')
    }
  }, [])

  const onImport = useCallback(async () => {
    if (!pendingImport || !dictionaryName.trim()) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    const id = createCustomDictionaryId()
    const dictionary: Dictionary = {
      id,
      name: dictionaryName.trim(),
      description: `本地导入 · ${pendingImport.fileName}`,
      category: '自定义词库',
      tags: ['我的词库'],
      url: createCustomDictionaryUrl(id),
      length: pendingImport.words.length,
      language: 'en',
      languageCategory: 'en',
      chapterCount: calcChapterCount(pendingImport.words.length),
    }

    try {
      await saveCustomDictionaryWords(id, pendingImport.words)
      registerCustomDictionary(dictionary)
      setCustomDictionaries((current) => [...current, dictionary])
      resetPendingImport()
    } catch (error) {
      unregisterCustomDictionary(id)
      await deleteCustomDictionaryWords(id)
      setErrorMessage(error instanceof Error ? error.message : '词库保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [dictionaryName, pendingImport, resetPendingImport, setCustomDictionaries])

  const onDelete = useCallback(
    async (dictionary: Dictionary) => {
      const shouldDelete = window.confirm(`确定删除自定义词库“${dictionary.name}”吗？本词库的学习记录不会被删除。`)
      if (!shouldDelete) {
        return
      }

      await deleteCustomDictionaryWords(dictionary.id)
      unregisterCustomDictionary(dictionary.id)
      setCustomDictionaries((current) => current.filter((item) => item.id !== dictionary.id))

      if (currentDictId === dictionary.id) {
        setCurrentDictId('cet4')
        setCurrentChapter(0)
      }
    },
    [currentDictId, setCurrentChapter, setCurrentDictId, setCustomDictionaries],
  )

  return (
    <Dialog onOpenChange={(open) => !open && resetPendingImport()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <IconUpload className="h-4 w-4" />
          自定义词库
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>自定义词库</DialogTitle>
          <DialogDescription>从本机导入 JSON 或 CSV。词库只保存在当前浏览器，不会上传到服务器。</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">导入新词库</p>
                <p className="mt-1 text-xs text-slate-500">JSON 支持 name/trans；CSV 支持 word,translation 或 name,trans。</p>
              </div>
              <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
                选择文件
              </Button>
              <input ref={fileInputRef} type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={onSelectFile} />
            </div>

            {pendingImport && (
              <div className="mt-4 space-y-3 rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-500">词库名称</span>
                  <input
                    value={dictionaryName}
                    onChange={(event) => setDictionaryName(event.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <div className="text-sm text-slate-500">
                  <p>{pendingImport.words.length} 个词条 · {pendingImport.fileName}</p>
                  <p className="mt-1 truncate">预览：{pendingImport.words.slice(0, 5).map((word) => word.name).join('、')}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={resetPendingImport} disabled={isSaving}>
                    取消
                  </Button>
                  <Button size="sm" onClick={onImport} disabled={isSaving || !dictionaryName.trim()}>
                    {isSaving ? '导入中…' : '确认导入'}
                  </Button>
                </div>
              </div>
            )}

            {errorMessage && <p className="mt-3 text-sm text-red-500">{errorMessage}</p>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">我的词库</p>
              <span className="text-xs text-slate-500">{customDictionaries.length} 个</span>
            </div>
            {customDictionaries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                还没有自定义词库
              </div>
            ) : (
              <div className="space-y-2">
                {customDictionaries.map((dictionary) => (
                  <div
                    key={dictionary.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{dictionary.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{dictionary.length} 词 · {dictionary.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-3 shrink-0 text-slate-400 hover:text-red-500"
                      onClick={() => onDelete(dictionary)}
                      aria-label={`删除 ${dictionary.name}`}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
