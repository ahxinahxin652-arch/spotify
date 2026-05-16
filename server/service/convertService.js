const convertDao = require('../dao/convertDao')
const ApiResult = require('../pojo/vo/ApiResult')
const { ConvertProgressEvent } = require('../pojo/vo/ResponseVOs')
const path = require('path')
const fs = require('fs')

// ========== 格式转换 Service ==========

/**
 * 扫描 FLAC 文件
 * @param {string[]} filePaths
 * @returns {import('../pojo/vo/ApiResult')<{ files: Array<import('../pojo/vo/ResponseVOs').ScanFileItem> }>}
 */
function scanFlacFiles(filePaths) {
  if (!filePaths || !Array.isArray(filePaths)) {
    return ApiResult.fail('无效的文件路径')
  }
  const result = convertDao.scanFlacFiles(filePaths)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ files: result.files })
}

/**
 * 开始转换
 * @param {Array<{name: string, path: string, size: number}>} files - 文件列表
 * @param {string} outputPath - 输出目录
 * @param {Function} onProgress - 进度回调
 */
async function startConvert(files, outputPath, onProgress) {
  const ffmpegPath = convertDao.getFfmpegPath()
  if (!ffmpegPath) {
    return ApiResult.fail('未找到 ffmpeg，请确保已安装')
  }

  if (!fs.existsSync(outputPath)) {
    return ApiResult.fail('输出目录不存在')
  }

  const total = files.length

  for (let i = 0; i < total; i++) {
    const file = files[i]
    const inputFile = file.path
    const outputFile = path.join(outputPath, file.name.replace(/\.flac$/i, '.mp3'))

    onProgress(new ConvertProgressEvent({
      type: 'file-progress',
      index: i,
      filename: file.name,
      progress: 0,
      totalProgress: Math.round((i / total) * 100),
    }))

    try {
      await convertDao.convertFile(ffmpegPath, inputFile, outputFile, (progress) => {
        const overall = Math.round(((i + progress / 100) / total) * 100)
        onProgress(new ConvertProgressEvent({
          type: 'file-progress',
          index: i,
          filename: file.name,
          progress,
          totalProgress: overall,
        }))
      })

      onProgress(new ConvertProgressEvent({
        type: 'file-done',
        index: i,
        filename: file.name,
        outputFile,
        totalProgress: Math.round(((i + 1) / total) * 100),
      }))
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

  return ApiResult.ok(null, '转换完成')
}

module.exports = {
  scanFlacFiles,
  startConvert,
}
