const { contextBridge, ipcRenderer } = require('electron')

const API_PORT = 3000

function apiFetch(url, options = {}) {
  return fetch(`http://localhost:${API_PORT}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).then(res => res.json())
}

// ========== 音乐仓库 API ==========
function getMusicWarehouses() {
  return apiFetch('/api/music/warehouses')
}

function createMusicWarehouse(name) {
  return apiFetch('/api/music/warehouses', { method: 'POST', body: { name } })
}

function deleteMusicWarehouse(name) {
  return apiFetch(`/api/music/warehouses/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

function getWarehouseTracks(warehouseName) {
  return apiFetch(`/api/music/warehouses/${encodeURIComponent(warehouseName)}/tracks`)
}

function importFilesToWarehouse(warehouseName, filePaths) {
  return apiFetch(`/api/music/warehouses/${encodeURIComponent(warehouseName)}/import`, {
    method: 'POST',
    body: { filePaths },
  })
}

function getMusicWarehouseDir() {
  return apiFetch('/api/music/warehouse-dir').then(r => r.success ? r.path : null)
}

// ========== 格式转换 API ==========
function scanFiles(filePaths) {
  return apiFetch('/api/convert/scan', { method: 'POST', body: { filePaths } })
}

function startConvert({ files, outputPath }) {
  return apiFetch('/api/convert/start', { method: 'POST', body: { files, outputPath } })
}

async function selectDirectory() {
  const res = await fetch(`http://localhost:${API_PORT}/api/convert/select-directory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const data = await res.json()
  return data.success ? data.path : null
}

// ========== 音乐解密 API ==========
function scanDecryptFiles(filePaths) {
  return apiFetch('/api/decrypt/scan', { method: 'POST', body: { filePaths } })
}

function startDecrypt({ files, outputPath }) {
  return apiFetch('/api/decrypt/start', { method: 'POST', body: { files, outputPath } })
}

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
    // 👇 改为向主进程发送 invoke 请求，并等待主进程返回文件路径数组
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
  deleteMusicWarehouse,
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