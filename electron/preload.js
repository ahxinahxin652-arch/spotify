const { contextBridge, ipcRenderer } = require('electron')

const API_PORT = 3000

/**
 * 统一 API 请求封装
 * 返回值统一为 ApiResult 格式: { success: boolean, data?: T, message?: string, error?: string }
 */
function apiFetch(url, options = {}) {
  return fetch(`http://localhost:${API_PORT}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).then(res => res.json())
}

// ========== 音乐仓库 API ==========

/** @returns {Promise<{ success: boolean, data?: { warehouses: Array<{name: string, path: string, trackCount: number, description: string, coverPath: string, recentPlayedAt: string|null}> }, error?: string }>} */
function getMusicWarehouses(sortBy) {
  const query = sortBy ? `?sortBy=${encodeURIComponent(sortBy)}` : ''
  return apiFetch(`/api/music/warehouses${query}`)
}

/** @returns {Promise<{ success: boolean, data?: { warehouse: {name: string, path: string, trackCount: number} }, error?: string }>} */
function createMusicWarehouse(name) {
  return apiFetch('/api/music/warehouses', { method: 'POST', body: { name } })
}

/** @returns {Promise<{ success: boolean }>} */
function updateRecentPlayedById(libraryId) {
  return apiFetch(`/api/music/libraries/${encodeURIComponent(libraryId)}/recent-played`, { method: 'POST', body: {} })
}

/** 通过 library ID 获取曲目列表 */
function getWarehouseTracksById(libraryId) {
  return apiFetch(`/api/music/libraries/${encodeURIComponent(libraryId)}/tracks`)
}

/** 通过 library ID 导入文件 */
function importFilesToWarehouseById(libraryId, filePaths) {
  return apiFetch(`/api/music/libraries/${encodeURIComponent(libraryId)}/import`, {
    method: 'POST',
    body: { filePaths },
  })
}

/** 通过 library ID 同步音乐库 */
function syncWarehouseById(libraryId) {
  return apiFetch(`/api/music/libraries/${encodeURIComponent(libraryId)}/sync`, { method: 'POST', body: {} })
}

/** 通过 library ID 更新音乐库信息 */
function updateMusicWarehouseById(libraryId, updates) {
  return apiFetch(`/api/music/libraries/${encodeURIComponent(libraryId)}`, { method: 'PUT', body: updates })
}

/** 通过 library ID 删除音乐库 */
function deleteMusicWarehouseById(libraryId) {
  return apiFetch(`/api/music/libraries/${encodeURIComponent(libraryId)}`, { method: 'DELETE' })
}

/** 通过 track ID 解析当前最新的 track 信息（含最新 path） */
function resolveTrackById(trackId) {
  return apiFetch(`/api/music/tracks/${encodeURIComponent(trackId)}`)
}

/** 更新曲目信息（编辑歌曲） */
function updateTrack(trackId, data) {
  return apiFetch(`/api/music/tracks/${encodeURIComponent(trackId)}`, { method: 'PUT', body: data })
}

/** 删除曲目 */
function deleteTrack(trackId) {
  return apiFetch(`/api/music/tracks/${encodeURIComponent(trackId)}`, { method: 'DELETE' })
}

// ========== 格式转换 API ==========

/** @returns {Promise<{ success: boolean, data?: { files: Array<{name: string, path: string, size: number}> }, error?: string }>} */
function scanFiles(filePaths) {
  return apiFetch('/api/convert/scan', { method: 'POST', body: { filePaths } })
}

/** @returns {Promise<{ success: boolean, data?: null, message?: string, error?: string }>} */
function startConvert({ files, outputPath }) {
  return apiFetch('/api/convert/start', { method: 'POST', body: { files, outputPath } })
}

/** @returns {Promise<string|null>} */
async function selectDirectory() {
  const data = await apiFetch('/api/convert/select-directory', { method: 'POST', body: {} })
  return data.success && data.data ? data.data.path : null
}

// ========== 音乐解密 API ==========

/** @returns {Promise<{ success: boolean, data?: { files: Array<{name: string, path: string, size: number}> }, error?: string }>} */
function scanDecryptFiles(filePaths) {
  return apiFetch('/api/decrypt/scan', { method: 'POST', body: { filePaths } })
}

/** @returns {Promise<{ success: boolean, data?: null, message?: string, error?: string }>} */
function startDecrypt({ files, outputPath }) {
  return apiFetch('/api/decrypt/start', { method: 'POST', body: { files, outputPath } })
}

/** @returns {Promise<{ success: boolean, data?: { outputPath: string, outputFileName: string }, error?: string }>} */
function decryptFile({ inputPath, outputPath, outputFormat }) {
  return apiFetch('/api/decrypt/file', { method: 'POST', body: { inputPath, outputPath, outputFormat } })
}

// ========== 进度监听 ==========
let progressCallback = null
ipcRenderer.on('convert-progress', (event, data) => {
  if (progressCallback) progressCallback(data)
})
function onConvertProgress(callback) {
  progressCallback = callback
}

let decryptProgressCallback = null
ipcRenderer.on('decrypt-progress', (event, data) => {
  if (decryptProgressCallback) decryptProgressCallback(data)
})
function onDecryptProgress(callback) {
  decryptProgressCallback = callback
}

// ========== 读取文件为 Blob ==========
function getMimeType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase()
  const map = {
    flac: 'audio/flac',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    wma: 'audio/x-ms-wma',
  }
  return map[ext] || 'application/octet-stream'
}

async function readFileAsBlob(filePath) {
  return new Promise((resolve, reject) => {
    const key = `read-file-${Date.now()}-${Math.random()}`
    const handler = (event, data) => {
      if (data.key === key) {
        ipcRenderer.removeListener('read-file-result', handler)
        if (data.error) {
          reject(new Error(data.error))
        } else {
          // data.buffer 是 ArrayBuffer
          const blob = new Blob([data.buffer], { type: data.mimeType })
          resolve(blob)
        }
      }
    }
    ipcRenderer.on('read-file-result', handler)
    ipcRenderer.send('read-file', { key, filePath })
  })
}

// ========== 窗口控制 ==========
function minimizeWindow() { ipcRenderer.send('window-minimize') }
function maximizeWindow() { ipcRenderer.send('window-maximize') }
function closeWindow() { ipcRenderer.send('window-close') }

let maximizedCallback = null
ipcRenderer.on('window-maximized-changed', (event, isMaximized) => {
  if (maximizedCallback) maximizedCallback(isMaximized)
})
function onWindowMaximized(callback) { maximizedCallback = callback }

// ========== 选择音频文件 ==========
async function selectMusicFiles() {
  try {
    return await ipcRenderer.invoke('dialog:selectMusicFiles')
  } catch (err) {
    console.error('选择音频文件出错:', err)
    return []
  }
}

// ========== 暴露 API ==========
contextBridge.exposeInMainWorld('electronAPI', {
  // 音乐仓库
  getMusicWarehouses,
  createMusicWarehouse,
  updateMusicWarehouseById,
  deleteMusicWarehouseById,
  updateRecentPlayedById,
  getWarehouseTracksById,
  importFilesToWarehouseById,
  syncWarehouseById,
  resolveTrackById,
  updateTrack,
  deleteTrack,
  // 格式转换
  scanFiles,
  startConvert,
  selectDirectory,
  // 音乐解密
  scanDecryptFiles,
  startDecrypt,
  decryptFile,
  // 进度 & 窗口
  onConvertProgress,
  onDecryptProgress,
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  onWindowMaximized,
  // 选择文件
  selectMusicFiles,
  // 文件读取
  readFileAsBlob,
})
