const PROGRESS_KEY = "yomuzuu_progress"

function getAll() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {} } catch { return {} }
}

function saveAll(data) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data))
}

export function markInProgress(chapterId, page, total) {
  const all = getAll()
  all[chapterId] = { page, total, completed: false }
  saveAll(all)
}

export function markCompleted(chapterId, total) {
  const all = getAll()
  all[chapterId] = { page: total, total, completed: true }
  saveAll(all)
}

export function getProgress(chapterId) {
  return getAll()[chapterId] || null
}

export function useReadProgress() {
  function getChapterProgress(chapterId) {
    return getAll()[chapterId] || null
  }
  return { getChapterProgress }
}