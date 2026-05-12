const express = require('express')
const router = express.Router()
const decryptService = require('../service/decryptService')

// GET /api/decrypt/formats - 获取支持的格式列表
router.get('/formats', (req, res) => {
  const result = decryptService.getSupportedFormats()
  res.json(result)
})

// POST /api/decrypt/check - 检查文件是否可解密
router.post('/check', (req, res) => {
  const { filePath } = req.body
  const result = decryptService.checkDecryptable(filePath)
  res.json(result)
})

// POST /api/decrypt/file - 解密文件
router.post('/file', async (req, res) => {
  const { inputPath, outputPath, outputFormat } = req.body
  const result = await decryptService.decryptFile(inputPath, outputPath, outputFormat || 'mp3')
  res.json(result)
})

// POST /api/decrypt/select-directory - 选择输出目录
router.post('/select-directory', async (req, res) => {
  try {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择输出目录',
    })
    if (result.canceled) {
      return res.json({ success: false, canceled: true })
    }
    res.json({ success: true, path: result.filePaths[0] })
  } catch (err) {
    res.json({ success: false, error: err.message })
  }
})

module.exports = router