const express = require('express')
const fs = require('fs')
const lyricsDecryptService = require('../service/lyricsDecryptService')
const ApiResult = require('../pojo/vo/ApiResult')

module.exports = function(mainWindow) {
  const router = express.Router()

  router.get('/formats', (req, res) => {
    res.json(lyricsDecryptService.getSupportedFormats())
  })

  router.post('/scan', (req, res) => {
    const { filePaths } = req.body
    res.json(lyricsDecryptService.scanLyricsFiles(filePaths))
  })

  router.post('/start', async (req, res) => {
    const { files, outputPath } = req.body
    if (!files || !outputPath) {
      return res.json(ApiResult.fail('缺少参数'))
    }

    if (!fs.existsSync(outputPath)) {
      return res.json(ApiResult.fail('输出目录不存在'))
    }

    res.json(ApiResult.ok(null, '解密开始'))

    await lyricsDecryptService.startDecrypt(files, outputPath, (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lyrics-decrypt-progress', data)
      }
    })
  })

  return router
}
