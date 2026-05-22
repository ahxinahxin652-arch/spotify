const fs = require('fs')
const zlib = require('zlib')

function decryptKrc(filePath) {
  const buffer = fs.readFileSync(filePath)
  const magic = buffer.slice(0, 4).toString()
  if (magic !== 'krc1') {
    throw new Error('Not a valid krc file')
  }

  const key = Buffer.from([64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105])
  const encrypted = buffer.slice(4)
  const decrypted = Buffer.alloc(encrypted.length)

  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ key[i % 16]
  }

  const decompressed = zlib.unzipSync(decrypted)
  return decompressed.toString('utf8')
}

// test code
// try to find any .krc file in user dirs?
console.log('KRC algorithm check ready')
