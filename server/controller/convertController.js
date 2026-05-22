const express = require('express')
const fs = require('fs')
const { dialog } = require('electron')
const convertDao = require('../dao/convertDao')
const convertService = require('../service/convertService')
const ApiResult = require('../pojo/vo/ApiResult')

module.exports = function(mainWindow) {
  const router = express.Router()

  router.post('/scan', (req, res) => {
    const { filePaths } = req.body
    res.json(convertService.scanFlacFiles(filePaths))
  })

  router.post('/start', async (req, res) => {
    const { files, outputPath } = req.body
    if (!files || !outputPath) {
      return res.json(ApiResult.fail('缺少参数'))
    }

    const ffmpegPath = convertDao.getFfmpegPath()
    if (!ffmpegPath) {
      return res.json(ApiResult.fail('未找到 ffmpeg，请确保已安装'))
    }

    if (!fs.existsSync(outputPath)) {
      return res.json(ApiResult.fail('输出目录不存在'))
    }

    res.json(ApiResult.ok(null, '转换开始'))

    await convertService.startConvert(files, outputPath, (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('convert-progress', data)
      }
    })
  })

  router.post('/select-directory', async (req, res) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择输出目录',
      })
      if (result.canceled) {
        return res.json(ApiResult.fail('已取消'))
      }
      res.json(ApiResult.ok({ path: result.filePaths[0] }))
    } catch (err) {
      res.json(ApiResult.fail(err.message))
    }
  })

  return router
}
