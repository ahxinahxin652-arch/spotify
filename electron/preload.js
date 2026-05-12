const { contextBridge, ipcRenderer } = require('electron')

const API_PORT = 3000

// ========== 文件扫描 ==========
async function scanFiles(filePaths) {
  const res = await fetch(`http://localhost:${API_PORT}/api/scan-flac`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePaths }),
  })
  return res.json()
}

// ========== 选择目录 ==========
async function selectDirectory() {
  const res = await fetch(`http://localhost:${API_PORT}/api/select-directory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const data = await res.json()
  return data.success ? data.path : null
}

// ========== 开始转换 ==========
async function startConvert({ files, outputPath }) {
  const res = await fetch(`http://localhost:${API_PORT}/api/start-convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, outputPath }),
  })
  return res.json()
}

// ========== 进度监听 ==========
let progressCallback = null

ipcRenderer.on('convert-progress', (event, data) => {
  if (progressCallback) {
    progressCallback(data)
  }
})

function onConvertProgress(callback) {
  progressCallback = callback
}

// ========== 窗口控制 ==========
function minimizeWindow() {
  ipcRenderer.send('window-minimize')
}

function maximizeWindow() {
  ipcRenderer.send('window-maximize')
}

function closeWindow() {
  ipcRenderer.send('window-close')
}

// ========== 最大化状态监听 ==========
let maximizedCallback = null

ipcRenderer.on('window-maximized-changed', (event, isMaximized) => {
  if (maximizedCallback) {
    maximizedCallback(isMaximized)
  }
})

function onWindowMaximized(callback) {
  maximizedCallback = callback
}

// ========== 暴露 API ==========
contextBridge.exposeInMainWorld('electronAPI', {
  scanFiles,
  selectDirectory,
  startConvert,
  onConvertProgress,
  // 窗口控制
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  onWindowMaximized,
})