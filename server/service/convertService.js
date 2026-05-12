const convertDao = require('../dao/convertDao')
const path = require('path')

// ========== 格式转换 Service ==========

/**
 * 扫描 FLAC 文件
 */
function scanFlacFiles(filePaths) {
  if (!filePaths || !Array.isArray(filePaths)) {
    return { success: false, error: '无效的文件路径' }
  }
  return convertDao.scanFlacFiles(filePaths)
}

/**
 * 开始转换
 * @param {Array} files - 文件列表 [{ name, path, size }]
 * @param {string} outputPath - 输出目录
 * @param {Function} onProgress - 进度回调
 */
async function startConvert(files, outputPath, onProgress) {
  const ffmpegPath = convertDao.getFfmpegPath()
  if (!ffmpegPath) {
    return { success: false, error: '未找到 ffmpeg，请确保已安装' }
  }

  if (!fs.existsSync(outputPath)) {
    return { success: false, error: '输出目录不存在' }
  }

  const total = files.length

  for (let i = 0; i < total; i++) {
    const file = files[i]
    const inputFile = file.path
    const outputFile = path.join(outputPath, file.name.replace(/\.flac$/i, '.mp3'))

    onProgress({
      type: 'file-progress',
      index: i,
      filename: file.name,
      progress: 0,
      totalProgress: Math.round((i / total) * 100),
    })

    try {
      await convertDao.convertFile(ffmpegPath, inputFile, outputFile, (progress) => {
        const overall = Math.round(((i + progress / 100) / total) * 100)
        onProgress({
          type: 'file-progress',
          index: i,
          filename: file.name,
          progress,
          totalProgress: overall,
        })
      })

      onProgress({
        type: 'file-done',
        index: i,
        filename: file.name,
        outputFile,
        totalProgress: Math.round(((i + 1) / total) * 100),
      })
    } catch (err) {
      onProgress({
        type: 'error',
        index: i,
        filename: file.name,
        error: err.message,
      })
    }
  }

  onProgress({
    type: 'all-done',
    total,
    outputPath,
  })

  return { success: true }
}

const fs = require('fs')

module.exports = {
  scanFlacFiles,
  startConvert,
}