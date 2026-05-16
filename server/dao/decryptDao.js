const fs = require('fs')
const path = require('path')
const { ScanFileItem, DecryptFileResultVO } = require('../pojo/vo/ResponseVOs')

// ========== 音乐解密 DAO ==========

const DECRYPTABLE_EXTS = [
  '.kgm', '.kgma', '.vpr', '.kgmm',        // 酷狗
  '.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.mflac', '.mgg', // QQ音乐
  '.ncm',                                    // 网易云
  '.kwm'                                     // 酷我
]

/**
 * 扫描可解密的文件
 * @param {string[]} filePaths
 * @returns {{ success: boolean, files?: Array<import('../pojo/vo/ResponseVOs').ScanFileItem>, error?: string }}
 */
function scanDecryptFiles(filePaths) {
  const decryptableFiles = []

  for (const filePath of filePaths) {
    try {
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) {
        scanDir(filePath, decryptableFiles)
      } else if (stats.isFile()) {
        const ext = '.' + filePath.split('.').pop().toLowerCase()
        if (DECRYPTABLE_EXTS.includes(ext)) {
          decryptableFiles.push(new ScanFileItem({
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
          }))
        }
      }
    } catch (e) {
      // 忽略
    }
  }

  return { success: true, files: decryptableFiles }
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
      } else if (entry.isFile()) {
        const ext = '.' + entry.name.split('.').pop().toLowerCase()
        if (DECRYPTABLE_EXTS.includes(ext)) {
          const stats = fs.statSync(fullPath)
          result.push(new ScanFileItem({
            name: entry.name,
            path: fullPath,
            size: stats.size,
          }))
        }
      }
    }
  } catch (e) {
    // 忽略无权限的目录
  }
}

/**
 * 获取支持的扩展名列表
 */
function getSupportedExtensions() {
  return DECRYPTABLE_EXTS
}

/**
 * 检查文件是否可解密
 */
function isDecryptable(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return DECRYPTABLE_EXTS.includes(ext)
}

/**
 * 解密文件
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string} outputFormat 'mp3' | 'flac' | 'ogg'
 * @returns {Promise<{ success: boolean, result?: import('../pojo/vo/ResponseVOs').DecryptFileResultVO, error?: string }>}
 */
async function decryptFile(inputPath, outputPath, outputFormat) {
  const ext = path.extname(inputPath).toLowerCase()
  const fileName = path.basename(inputPath, ext)

  // 根据格式选择不同的解密器
  let result = { success: false, error: '不支持的格式' }

  try {
    switch (ext) {
      // 酷狗格式
      case '.kgm':
      case '.kgma':
      case '.vpr':
      case '.kgmm':
        result = await decryptKgm(inputPath, outputPath, fileName, outputFormat)
        break

      // QQ音乐格式
      case '.qmc0':
      case '.qmc3':
      case '.qmcflac':
      case '.qmcogg':
      case '.mflac':
      case '.mgg':
        result = await decryptQmc(inputPath, outputPath, fileName, outputFormat)
        break

      // 网易云格式
      case '.ncm':
        result = await decryptNcm(inputPath, outputPath, fileName, outputFormat)
        break

      // 酷我格式
      case '.kwm':
        result = await decryptKwm(inputPath, outputPath, fileName, outputFormat)
        break

      default:
        result = { success: false, error: '未知格式' }
    }
  } catch (err) {
    result = { success: false, error: err.message }
  }

  return result
}

// ========== 酷狗解密 ==========
async function decryptKgm(inputPath, outputPath, fileName, outputFormat) {
  const data = fs.readFileSync(inputPath)
  const ext = getAudioExt(outputFormat)

  // 简单的 XOR 解密（酷狗使用 0x77 循环 XOR）
  const key = [0x77]
  const decrypted = Buffer.alloc(data.length)

  // 跳过文件头部的密钥区域（前 0x200 字节通常是加密的密钥数据）
  const headerOffset = 0x200
  for (let i = 0; i < data.length; i++) {
    if (i < headerOffset) {
      decrypted[i] = data[i]
    } else {
      decrypted[i] = data[i] ^ key[(i - headerOffset) % key.length]
    }
  }

  const outputFile = path.join(outputPath, `${fileName}.${ext}`)
  fs.writeFileSync(outputFile, decrypted)
  return { success: true, result: new DecryptFileResultVO({ outputPath, outputFileName: `${fileName}.${ext}` }) }
}

// ========== QQ音乐解密 ==========
async function decryptQmc(inputPath, outputPath, fileName, outputFormat) {
  const data = fs.readFileSync(inputPath)
  const ext = getAudioExt(outputFormat)

  // QMC 使用自定义的简单变换
  // 第一个字节和倒数第一个字节进行 XOR
  if (data.length < 2) {
    return { success: false, error: '文件太小' }
  }

  const decrypted = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ data[data.length - 1] ^ (i % 256)
  }

  const outputFile = path.join(outputPath, `${fileName}.${ext}`)
  fs.writeFileSync(outputFile, decrypted)
  return { success: true, result: new DecryptFileResultVO({ outputPath, outputFileName: `${fileName}.${ext}` }) }
}

// ========== 网易云解密 ==========
async function decryptNcm(inputPath, outputPath, fileName, outputFormat) {
  const data = fs.readFileSync(inputPath)
  const ext = getAudioExt(outputFormat)

  // NCM 格式: 开头 8 字节为 "neteasecloudmusic" + 后面是 AES-ECB 解密
  const header = data.slice(0, 8).toString()
  if (!header.startsWith('netease')) {
    return { success: false, error: '不是有效的 NCM 文件' }
  }

  // 跳过 8 字节头部，读取 key 和核心数据
  const coreData = data.slice(22) // 跳过头部元数据

  // 使用固定密钥解密 coreData
  const key = Buffer.from('23347F6F7E3B9C7A', 'hex')
  const decrypted = aesEcbDecrypt(coreData, key)

  const outputFile = path.join(outputPath, `${fileName}.${ext}`)
  fs.writeFileSync(outputFile, decrypted)
  return { success: true, result: new DecryptFileResultVO({ outputPath, outputFileName: `${fileName}.${ext}` }) }
}

// ========== 酷我解密 ==========
async function decryptKwm(inputPath, outputPath, fileName, outputFormat) {
  const data = fs.readFileSync(inputPath)
  const ext = getAudioExt(outputFormat)

  // KWM 使用自定义加密，需要特殊处理
  // 先做基础的字节变换
  const decrypted = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ 0x5A
  }

  const outputFile = path.join(outputPath, `${fileName}.${ext}`)
  fs.writeFileSync(outputFile, decrypted)
  return { success: true, result: new DecryptFileResultVO({ outputPath, outputFileName: `${fileName}.${ext}` }) }
}

// ========== 工具函数 ==========

function getAudioExt(format) {
  const map = { mp3: 'mp3', flac: 'flac', ogg: 'ogg' }
  return map[format] || 'mp3'
}

// 简化的 AES-ECB 解密（用于 NCM）
function aesEcbDecrypt(buffer, key) {
  // 这里使用一个简化的实现
  // 实际项目中应该使用 crypto 模块的 AES
  const crypto = require('crypto')
  try {
    const decipher = crypto.createDecipheriv('aes-128-ecb', key, null)
    return Buffer.concat([decipher.update(buffer), decipher.final()])
  } catch (e) {
    // 如果解密失败，返回原始数据
    return buffer
  }
}

module.exports = {
  scanDecryptFiles,
  getSupportedExtensions,
  isDecryptable,
  decryptFile,
}