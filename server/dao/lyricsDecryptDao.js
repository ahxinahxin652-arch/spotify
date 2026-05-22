const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const crypto = require('crypto')
const ApiResult = require('../pojo/vo/ApiResult')

const SUPPORTED_EXTS = ['.krc']

const KRC_MAGIC = 'krc1'
const KRC_KEY = Buffer.from([64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105])

function getSupportedExtensions() {
  return SUPPORTED_EXTS
}

function isDecryptable(filePath) {
  if (!filePath) return false
  const ext = path.extname(filePath).toLowerCase()
  return SUPPORTED_EXTS.includes(ext)
}

function scanLyricsFiles(filePaths) {
  const result = []
  try {
    for (const p of filePaths) {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p)
        if (stat.isDirectory()) {
          const files = fs.readdirSync(p)
          for (const f of files) {
            const fullPath = path.join(p, f)
            if (fs.statSync(fullPath).isFile() && isDecryptable(fullPath)) {
              result.push({
                name: path.basename(fullPath),
                path: fullPath,
                size: fs.statSync(fullPath).size
              })
            }
          }
        } else if (stat.isFile() && isDecryptable(p)) {
          result.push({
            name: path.basename(p),
            path: p,
            size: stat.size
          })
        }
      }
    }
    // Deduplicate
    const unique = []
    const map = new Map()
    for (const item of result) {
      if (!map.has(item.path)) {
        map.set(item.path, true)
        unique.push(item)
      }
    }
    return { success: true, files: unique }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function convertKrcToLrc(krcText) {
  const lines = krcText.split(/\r?\n/)
  const lrcLines = []
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    // Check standard tags
    if (line.match(/^\[(ti|ar|al|by|offset|id|hash):.*\]/)) {
      lrcLines.push(line)
      continue
    }
    
    // Check krc timing line: [start_time,duration]<...>
    const krcMatch = line.match(/^\[(\d+),\d+\](.*)/)
    if (krcMatch) {
      const startTime = parseInt(krcMatch[1], 10)
      const rest = krcMatch[2]
      
      const totalSec = Math.floor(startTime / 1000)
      const mm = Math.floor(totalSec / 60).toString().padStart(2, '0')
      const ss = (totalSec % 60).toString().padStart(2, '0')
      const xx = Math.floor((startTime % 1000) / 10).toString().padStart(2, '0')
      const timeStr = `[${mm}:${ss}.${xx}]`
      
      const text = rest.replace(/<[^>]*>/g, '')
      lrcLines.push(`${timeStr}${text}`)
    } else {
      lrcLines.push(line)
    }
  }
  
  return lrcLines.join('\n')
}

async function decryptFile(inputPath, outputPath) {
  try {
    const ext = path.extname(inputPath).toLowerCase()
    if (ext !== '.krc') {
      return { success: false, error: '目前仅支持.krc格式解密' }
    }

    const buffer = fs.readFileSync(inputPath)
    if (buffer.length < 4) {
      return { success: false, error: '文件过小或损坏' }
    }

    const magic = buffer.slice(0, 4).toString()
    if (magic !== KRC_MAGIC) {
      return { success: false, error: '非标准的 krc1 头部' }
    }

    const encrypted = buffer.slice(4)
    const decrypted = Buffer.alloc(encrypted.length)

    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ KRC_KEY[i % 16]
    }

    let decompressedText = ''
    try {
      const decompressed = zlib.unzipSync(decrypted)
      decompressedText = decompressed.toString('utf8')
    } catch (e) {
      return { success: false, error: 'zlib解压失败: ' + e.message }
    }

    const lrcText = convertKrcToLrc(decompressedText)
    
    const baseName = path.basename(inputPath, ext)
    const outputFileName = `${baseName}.lrc`
    const finalOutputPath = path.join(outputPath, outputFileName)
    
    fs.writeFileSync(finalOutputPath, lrcText, 'utf8')
    
    return {
      success: true,
      result: {
        outputPath: finalOutputPath,
        outputFileName: outputFileName
      }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

module.exports = {
  getSupportedExtensions,
  isDecryptable,
  scanLyricsFiles,
  decryptFile
}
