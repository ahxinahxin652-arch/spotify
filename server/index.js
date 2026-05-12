const express = require('express')

const app = express()
const PORT = process.env.EXPRESS_PORT || 3000

// Middleware
app.use(express.json())

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Express server is running' })
})

// Example endpoint
app.post('/api/example', (req, res) => {
  res.json({ received: req.body, status: 'success' })
})

// Start server
const server = app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`)
})

module.exports = { app, server }
