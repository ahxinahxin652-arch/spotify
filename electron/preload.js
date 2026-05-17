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

/** @returns {Promise<{ success: boolean, data?: null, error?: string }>} */
function deleteMusicWarehouse(name) {
  return apiFetch(`/api/music/warehouses/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

/** @returns {Promise<{ success: boolean, data?: { warehouse: Object }, error?: string }>} */
function updateMusicWarehouse(oldName, updates) {
  return apiFetch(`/api/music/warehouses/${encodeURIComponent(oldName)}`, { method: 'PUT', body: updates })
}

/** @returns {Promise<{ success: boolean }>} */
function updateRecentPlayed(warehouseName) {
  return apiFetch(`/api/music/warehouses/${encodeURIComponent(warehouseName)}/recent-played`, { method: 'POST', body: {} })
}

/** @returns {Promise<{ success: boolean, data?: { warehouseName: string, tracks: Array, warehouse: { name: string, description: string, coverPath: string } }, error?: string }>} */
function getWarehouseTracks(warehouseName) {
  return apiFetch(`/api/music/warehouses/${encodeURIComponent(warehouseName)}/tracks`)
}

/** @returns {Promise<{ success: boolean, data?: { imported: number, skipped: number }, error?: string }>} */
function importFilesToWarehouse(warehouseName, filePaths) {
  return apiFetch(`/api/music/warehouses/${encodeURIComponent(warehouseName)}/import`, {
    method: 'POST',
    body: { filePaths },
  })
}

/** @returns {Promise<string|null>} */
async function getMusicWarehouseDir() {
  const r = await apiFetch('/api/music/warehouse-dir')
  return r.success && r.data ? r.data.path : null
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
  updateMusicWarehouse,
  deleteMusicWarehouse,
  updateRecentPlayed,
  getWarehouseTracks,
  importFilesToWarehouse,
  getMusicWarehouseDir,
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
