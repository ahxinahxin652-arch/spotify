const decryptDao = require('../dao/decryptDao')
const fs = require('fs')

// ========== 音乐解密 Service ==========

/**
 * 获取支持的格式列表
 */
function getSupportedFormats() {
  return {
    success: true,
    formats: decryptDao.getSupportedExtensions(),
  }
}

/**
 * 扫描可解密的文件
 */
function scanDecryptFiles(filePaths) {
  if (!filePaths || !Array.isArray(filePaths)) {
    return { success: false, error: '无效的文件路径' }
  }
  return decryptDao.scanDecryptFiles(filePaths)
}

/**
 * 检查文件是否可解密
 */
function checkDecryptable(filePath) {
  return {
    success: true,
    canDecrypt: decryptDao.isDecryptable(filePath),
  }
}

/**
 * 解密文件
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出目录
 * @param {string} outputFormat - 输出格式 'mp3' | 'flac' | 'ogg'
 */
async function decryptFile(inputPath, outputPath, outputFormat = 'mp3') {
  // 验证输入文件
  if (!inputPath || !fs.existsSync(inputPath)) {
    return { success: false, error: '输入文件不存在' }
  }

  // 验证输出目录
  if (!outputPath || !fs.existsSync(outputPath)) {
    return { success: false, error: '输出目录不存在' }
  }

  // 检查格式是否支持
  if (!decryptDao.isDecryptable(inputPath)) {
    return { success: false, error: '不支持该格式的解密' }
  }

  const result = await decryptDao.decryptFile(inputPath, outputPath, outputFormat)
  return result
}

/**
 * 开始批量解密
 * @param {Array} files - 文件列表 [{ name, path, size }]
 * @param {string} outputPath - 输出目录
 * @param {Function} onProgress - 进度回调
 */
async function startDecrypt(files, outputPath, onProgress) {
  if (!fs.existsSync(outputPath)) {
    return { success: false, error: '输出目录不存在' }
  }

  const total = files.length

  for (let i = 0; i < total; i++) {
    const file = files[i]

    onProgress({
      type: 'file-progress',
      index: i,
      filename: file.name,
      progress: 0,
      totalProgress: Math.round((i / total) * 100),
    })

    try {
      const result = await decryptDao.decryptFile(file.path, outputPath, 'mp3')

      if (result.success) {
        onProgress({
          type: 'file-done',
          index: i,
          filename: file.name,
          outputFile: result.outputFileName,
          totalProgress: Math.round(((i + 1) / total) * 100),
        })
      } else {
        onProgress({
          type: 'error',
          index: i,
          filename: file.name,
          error: result.error,
        })
      }
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

module.exports = {
  scanDecryptFiles,
  getSupportedFormats,
  checkDecryptable,
  decryptFile,
  startDecrypt,
}