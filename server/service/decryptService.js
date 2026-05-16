const decryptDao = require('../dao/decryptDao')
const ApiResult = require('../pojo/vo/ApiResult')
const { ConvertProgressEvent, SupportedFormatsVO } = require('../pojo/vo/ResponseVOs')
const fs = require('fs')

// ========== 音乐解密 Service ==========

/**
 * 获取支持的格式列表
 * @returns {import('../pojo/vo/ApiResult')<{ formats: string[] }>}
 */
function getSupportedFormats() {
  return ApiResult.ok({ formats: decryptDao.getSupportedExtensions() })
}

/**
 * 扫描可解密的文件
 * @param {string[]} filePaths
 * @returns {import('../pojo/vo/ApiResult')<{ files: Array<import('../pojo/vo/ResponseVOs').ScanFileItem> }>}
 */
function scanDecryptFiles(filePaths) {
  if (!filePaths || !Array.isArray(filePaths)) {
    return ApiResult.fail('无效的文件路径')
  }
  const result = decryptDao.scanDecryptFiles(filePaths)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ files: result.files })
}

/**
 * 检查文件是否可解密
 * @param {string} filePath
 * @returns {import('../pojo/vo/ApiResult')<{ canDecrypt: boolean }>}
 */
function checkDecryptable(filePath) {
  return ApiResult.ok({ canDecrypt: decryptDao.isDecryptable(filePath) })
}

/**
 * 解密文件
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出目录
 * @param {string} outputFormat - 输出格式 'mp3' | 'flac' | 'ogg'
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ outputPath: string, outputFileName: string }>>}
 */
async function decryptFile(inputPath, outputPath, outputFormat = 'mp3') {
  // 验证输入文件
  if (!inputPath || !fs.existsSync(inputPath)) {
    return ApiResult.fail('输入文件不存在')
  }

  // 验证输出目录
  if (!outputPath || !fs.existsSync(outputPath)) {
    return ApiResult.fail('输出目录不存在')
  }

  // 检查格式是否支持
  if (!decryptDao.isDecryptable(inputPath)) {
    return ApiResult.fail('不支持该格式的解密')
  }

  const result = await decryptDao.decryptFile(inputPath, outputPath, outputFormat)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({
    outputPath: result.result.outputPath,
    outputFileName: result.result.outputFileName,
  })
}

/**
 * 开始批量解密
 * @param {Array<{name: string, path: string, size: number}>} files - 文件列表
 * @param {string} outputPath - 输出目录
 * @param {Function} onProgress - 进度回调
 */
async function startDecrypt(files, outputPath, onProgress) {
  if (!fs.existsSync(outputPath)) {
    return ApiResult.fail('输出目录不存在')
  }

  const total = files.length

  for (let i = 0; i < total; i++) {
    const file = files[i]

    onProgress(new ConvertProgressEvent({
      type: 'file-progress',
      index: i,
      filename: file.name,
      progress: 0,
      totalProgress: Math.round((i / total) * 100),
    }))

    try {
      const result = await decryptDao.decryptFile(file.path, outputPath, 'mp3')

      if (result.success) {
        onProgress(new ConvertProgressEvent({
          type: 'file-done',
          index: i,
          filename: file.name,
          outputFile: result.result.outputFileName,
          totalProgress: Math.round(((i + 1) / total) * 100),
        }))
      } else {
        onProgress(new ConvertProgressEvent({
          type: 'error',
          index: i,
          filename: file.name,
          error: result.error,
        }))
      }
    } catch (err) {
      onProgress(new ConvertProgressEvent({
        type: 'error',
        index: i,
        filename: file.name,
        error: err.message,
      }))
    }
  }

  onProgress(new ConvertProgressEvent({
    type: 'all-done',
    total,
    outputPath,
  }))

  return ApiResult.ok(null, '解密完成')
}

module.exports = {
  scanDecryptFiles,
  getSupportedFormats,
  checkDecryptable,
  decryptFile,
  startDecrypt,
}
