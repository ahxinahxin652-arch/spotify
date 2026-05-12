const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

// ========== 格式转换 DAO ==========

/**
 * 扫描目录下所有 FLAC 文件
 * @param {string[]} filePaths
 * @returns {{ success: boolean, files?: Array, error?: string }}
 */
function scanFlacFiles(filePaths) {
  const flacFiles = []

  for (const filePath of filePaths) {
    try {
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) {
        scanDir(filePath, flacFiles)
      } else if (stats.isFile()) {
        if (filePath.toLowerCase().endsWith('.flac')) {
          flacFiles.push({
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
          })
        }
      }
    } catch (e) {
      // 忽略
    }
  }

  return { success: true, files: flacFiles }
}

/**
 * 递归扫描目录
 */
function scanDir(dir, result) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath, result)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.flac')) {
        const stats = fs.statSync(fullPath)
        result.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
        })
      }
    }
  } catch (e) {
    // 忽略无权限的目录
  }
}

/**
 * 获取 ffmpeg 路径
 */
function getFfmpegPath() {
  try {
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
    return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
  } catch (err) {
    return null
  }
}

/**
 * 转换单个文件（带进度回调）
 * @param {string} ffmpegPath
 * @param {string} inputFile
 * @param {string} outputFile
 * @param {Function} onProgress
 */
function convertFile(ffmpegPath, inputFile, outputFile, onProgress) {
  return new Promise((resolve, reject) => {
    const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/
    const timeRegex = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/

    let durationMs = 0
    let progressEmitted = 0

    const args = [
      '-i', inputFile,
      '-c:a', 'libmp3lame',
      '-b:a', '320k',
      '-ar', '48000',
      '-map_metadata', '0',
      '-y', outputFile,
    ]

    const ffmpeg = spawn(ffmpegPath, args, { shell: false })

    ffmpeg.stdout.on('data', (data) => {
      parseProgress(data.toString(), durationRegex, timeRegex, durationMs, progressEmitted, onProgress, (d, p) => {
        durationMs = d
        progressEmitted = p
      })
    })

    ffmpeg.stderr.on('data', (data) => {
      parseProgress(data.toString(), durationRegex, timeRegex, durationMs, progressEmitted, onProgress, (d, p) => {
        durationMs = d
        progressEmitted = p
      })
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(`ffmpeg 进程退出，退出码: ${code}`))
      }
    })

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg 启动失败: ${err.message}`))
    })
  })
}

/**
 * 解析进度
 */
function parseProgress(str, durationRegex, timeRegex, durationMs, progressEmitted, onProgress, update) {
  const durMatch = str.match(durationRegex)
  if (durMatch && durationMs === 0) {
    const h = parseInt(durMatch[1])
    const m = parseInt(durMatch[2])
    const s = parseInt(durMatch[3])
    const cs = parseInt(durMatch[4])
    const newDurationMs = ((h * 3600 + m * 60 + s) * 100 + cs) * 10
    update(newDurationMs, progressEmitted)
  }

  const timeMatch = str.match(timeRegex)
  if (timeMatch && durationMs > 0) {
    const h = parseInt(timeMatch[1])
    const m = parseInt(timeMatch[2])
    const s = parseInt(timeMatch[3])
    const cs = parseInt(timeMatch[4])
    const currentMs = ((h * 3600 + m * 60 + s) * 100 + cs) * 10
    const pct = Math.min(100, Math.round((currentMs / durationMs) * 100))

    if (pct > progressEmitted) {
      update(durationMs, pct)
      onProgress(pct)
    }
  }
}

module.exports = {
  scanFlacFiles,
  getFfmpegPath,
  convertFile,
}