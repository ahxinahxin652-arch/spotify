const decryptDao = require('../dao/decryptDao')

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

const fs = require('fs')

module.exports = {
  getSupportedFormats,
  checkDecryptable,
  decryptFile,
}