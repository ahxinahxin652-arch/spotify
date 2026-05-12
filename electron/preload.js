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
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: '选择音频文件',
      filters: [
        { name: '音频文件', extensions: ['flac', 'mp3', 'ogg', 'wav', 'aac', 'm4a', 'kgm', 'kgma', 'qmc0', 'qmc3', 'qmcflac', 'qmcogg', 'mflac', 'mgg', 'ncm', 'kwm'] },
      ],
    })
    if (result.canceled) return []
    return result.filePaths
  } catch {
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
  decryptFile,
  // 进度 & 窗口
  onConvertProgress,
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  onWindowMaximized,
  // 选择文件
  selectMusicFiles,
})