const lyricsDecryptDao = require('../dao/lyricsDecryptDao')
const ApiResult = require('../pojo/vo/ApiResult')
const { ConvertProgressEvent } = require('../pojo/vo/ResponseVOs')
const fs = require('fs')

function getSupportedFormats() {
  return ApiResult.ok({ formats: lyricsDecryptDao.getSupportedExtensions() })
}

function scanLyricsFiles(filePaths) {
  if (!filePaths || !Array.isArray(filePaths)) {
    return ApiResult.fail('无效的文件路径')
  }
  const result = lyricsDecryptDao.scanLyricsFiles(filePaths)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ files: result.files })
}

function checkDecryptable(filePath) {
  return ApiResult.ok({ canDecrypt: lyricsDecryptDao.isDecryptable(filePath) })
}

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
      const result = await lyricsDecryptDao.decryptFile(file.path, outputPath)

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

  return ApiResult.ok(null, '歌词解密完成')
}

module.exports = {
  scanLyricsFiles,
  getSupportedFormats,
  checkDecryptable,
  startDecrypt
}
