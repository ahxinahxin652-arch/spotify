const express = require('express')
const router = express.Router()
const musicService = require('../service/musicService')

// GET /api/music/warehouses - 获取所有音乐库
router.get('/warehouses', (req, res) => {
  const result = musicService.getMusicWarehouses()
  res.json(result)
})

// POST /api/music/warehouses - 创建音乐库
router.post('/warehouses', (req, res) => {
  const { name } = req.body
  const result = musicService.createMusicWarehouse(name)
  res.json(result)
})

// DELETE /api/music/warehouses/:name - 删除音乐库
router.delete('/warehouses/:name', (req, res) => {
  const { name } = req.params
  const result = musicService.deleteMusicWarehouse(name)
  res.json(result)
})

// GET /api/music/warehouses/:name/tracks - 获取音乐库的曲目
router.get('/warehouses/:name/tracks', (req, res) => {
  const { name } = req.params
  const result = musicService.getWarehouseTracks(decodeURIComponent(name))
  res.json(result)
})

// POST /api/music/warehouses/:name/import - 导入文件到音乐库
router.post('/warehouses/:name/import', (req, res) => {
  const { name } = req.params
  const { filePaths } = req.body
  const result = musicService.importFilesToWarehouse(decodeURIComponent(name), filePaths)
  res.json(result)
})

// GET /api/music/warehouse-dir - 获取音乐仓库根目录
router.get('/warehouse-dir', (req, res) => {
  const dir = musicService.getMusicWarehouseDir()
  res.json({ success: true, path: dir })
})

module.exports = router