const express = require('express')
const router = express.Router()
const convertService = require('../service/convertService')
const path = require('path')

// 获取 sendProgress 函数
let sendProgress = null
function setProgressCallback(cb) {
  sendProgress = cb
}

// POST /api/convert/scan - 扫描 FLAC 文件
router.post('/scan', (req, res) => {
  const { filePaths } = req.body
  const result = convertService.scanFlacFiles(filePaths)
  res.json(result)
})

// POST /api/convert/start - 开始转换
router.post('/start', async (req, res) => {
  const { files, outputPath } = req.body

  if (!files || !outputPath) {
    return res.json({ success: false, error: '缺少参数' })
  }

  // 验证 ffmpeg
  const hasFfmpeg = require('../dao/convertDao').getFfmpegPath()
  if (!hasFfmpeg) {
    return res.json({ success: false, error: '未找到 ffmpeg' })
  }

  res.json({ success: true, message: '转换开始' })

  await convertService.startConvert(files, outputPath, (data) => {
    if (sendProgress) {
      sendProgress(data)
    }
  })
})

// POST /api/convert/select-directory - 选择目录（通过 Electron 对话框）
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

module.exports = { router, setProgressCallback }