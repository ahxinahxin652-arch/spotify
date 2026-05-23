const fs = require('fs')
const path = require('path')
const { ScanFileItem, DecryptFileResultVO } = require('../pojo/vo/ResponseVOs')
const umcrypto = require('@clamber_l/crypto')

// ========== 音乐解密 DAO ==========

const DECRYPTABLE_EXTS = [
  '.kgm', '.kgma', '.vpr', '.kgmm',        // 酷狗
  '.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.mflac', '.mgg', // QQ音乐
  '.ncm',                                    // 网易云
  '.kwm'                                     // 酷我
]

/**
 * 扫描可解密的文件
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

function getSupportedExtensions() {
  return DECRYPTABLE_EXTS
}

function isDecryptable(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return DECRYPTABLE_EXTS.includes(ext)
}

/**
 * 将 Node.js Buffer 转换为纯净的 Uint8Array，避免 Wasm 内存错位
 */
function getPureUint8Array(filePath) {
  const rawBuffer = fs.readFileSync(filePath)
  // 核心修复：切断与 Node.js Buffer Pool 的联系，克隆出一个独立的 ArrayBuffer
  return new Uint8Array(
      rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.byteLength)
  )
}

/**
 * 解密文件核心入口
 */
async function decryptFile(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase()
  const fileName = path.basename(inputPath, ext)

  await umcrypto.ready

  let result = { success: false, error: '不支持的格式' }

  try {
    const pureData = getPureUint8Array(inputPath)

    switch (ext) {
      case '.kgm':
      case '.kgma':
      case '.vpr':
      case '.kgmm':
        result = await decryptKgm(pureData, outputPath, fileName)
        break

      case '.qmc0':
      case '.qmc3':
      case '.qmcflac':
      case '.qmcogg':
      case '.mflac':
      case '.mgg':
        result = await decryptQmc(pureData, outputPath, fileName)
        break

      case '.ncm':
        result = await decryptNcm(pureData, outputPath, fileName)
        break

      case '.kwm':
        result = await decryptKwm(pureData, outputPath, fileName)
        break

      default:
        result = { success: false, error: '未知格式' }
    }
  } catch (err) {
    console.error(`[Decrypt Error] ${fileName}:`, err)
    result = { success: false, error: err.message }
  }

  return result
}

// ========== 酷狗解密 ==========
async function decryptKgm(pureData, outputPath, fileName) {
  let kugouHeader
  try {
    kugouHeader = new umcrypto.KuGouHeader(pureData)
  } catch (e) {
    throw new Error('无效的酷狗加密文件')
  }

  const offsetToData = kugouHeader.offsetToData
  kugouHeader.free()

  let kugou
  try {
    kugou = umcrypto.KuGou.from_header(pureData)
  } catch (e) {
    throw new Error('无法初始化酷狗解密器')
  }

  // 使用 slice 生成新的内存片段进行解密
  const audioData = pureData.slice(offsetToData)
  kugou.decrypt(audioData, 0)
  kugou.free()

  return saveAudioFile(audioData, outputPath, fileName)
}

// ========== QQ音乐解密 ==========
async function decryptQmc(pureData, outputPath, fileName) {
  const footerBuffer = pureData.slice(-Math.min(1024, pureData.length))
  let footer
  try {
    footer = umcrypto.QMCFooter.parse(footerBuffer)
  } catch (e) {
    footer = undefined
  }

  let realLength = pureData.length
  let ekey = ''

  if (footer) {
    ekey = footer.ekey
    realLength -= footer.size
    footer.free()
  }

  const audioData = pureData.slice(0, realLength)

  if (ekey) {
    const qmc2 = new umcrypto.QMC2(ekey)
    qmc2.decrypt(audioData, 0)
    qmc2.free()
  } else {
    umcrypto.decryptQMC1(audioData, 0)
  }

  return saveAudioFile(audioData, outputPath, fileName)
}

// ========== 网易云解密 ==========
async function decryptNcm(pureData, outputPath, fileName) {
  const ncm = new umcrypto.NCMFile()
  const openResult = ncm.open(pureData)

  if (openResult !== 0) {
    ncm.free()
    throw new Error('无效的网易云加密文件')
  }

  const offsetToData = ncm.audioOffset
  const audioData = pureData.slice(offsetToData)

  ncm.decrypt(audioData, 0)
  ncm.free()

  return saveAudioFile(audioData, outputPath, fileName)
}

// ========== 酷我解密 ==========
async function decryptKwm(pureData, outputPath, fileName) {
  let header
  try {
    header = umcrypto.KuwoHeader.parse(pureData)
  } catch (e) {
    throw new Error('无效的酷我加密文件')
  }

  let kwm
  try {
    kwm = new umcrypto.KWMDecipher(header)
  } catch (e) {
    if (header.free) header.free()
    throw new Error('无法初始化酷我解密器')
  }

  const offsetToData = 1024
  if (pureData.length <= offsetToData) {
    kwm.free()
    throw new Error('文件长度不正确')
  }

  const audioData = pureData.slice(offsetToData)
  kwm.decrypt(audioData, 0)
  kwm.free()

  return saveAudioFile(audioData, outputPath, fileName)
}

// ========== 工具函数 ==========

/**
 * 自动检测格式并保存文件（智能提取 FLAC）
 */
function saveAudioFile(audioData, outputPath, fileName) {
  let detected
  let realExt = 'flac' // 默认作为 FLAC 处理

  try {
    detected = umcrypto.detectAudioType(audioData)
    if (detected && detected.audioType) {
      realExt = detected.audioType
    }
    if (detected && detected.free) {
      detected.free()
    }
  } catch (e) {
    console.warn('格式检测失败，默认使用 .flac 后缀')
  }

  const outputFileName = `${fileName}.${realExt}`
  const outputFile = path.join(outputPath, outputFileName)

  fs.writeFileSync(outputFile, Buffer.from(audioData))

  return {
    success: true,
    result: new DecryptFileResultVO({ outputPath, outputFileName })
  }
}

module.exports = {
  scanDecryptFiles,
  getSupportedExtensions,
  isDecryptable,
  decryptFile,
}