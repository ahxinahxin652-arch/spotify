// Mock electron to allow running outside electron shell
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'electron') {
    return {
      app: {
        isPackaged: false,
        getPath: (name) => {
          if (name === 'home') {
            const os = require('os');
            return os.homedir();
          }
          return __dirname;
        }
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const path = require('path');
const fs = require('fs');
const { initDatabase, autoMigrate, getDb, disconnectDatabase } = require('../server/dao/db');

const testDbPath = path.join(__dirname, 'test-crud.db');
const testDbJournalPath = testDbPath + '-journal';

function cleanupDbFiles() {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbJournalPath)) fs.unlinkSync(testDbJournalPath);
  } catch (e) {
    console.warn('cleanup failed:', e.message);
  }
}

async function runTest() {
  cleanupDbFiles();
  initDatabase(testDbPath);
  await autoMigrate();
  const db = getDb();
  
  console.log('Testing Artist CRUD...');
  
  const artistId = 'test-uuid-artist';
  let exitCode = 0;
  
  try {
    // 1. Create artist
    await db.artist.create({
      data: { id: artistId, name: 'Original Name', metadata: '{}' }
    });
    
    // 2. Create a mock library
    const library = await db.musicLibrary.create({
      data: { id: 'test-lib-id', name: 'Test Library' }
    });
    
    // 3. Create a track bound to this artist in JSON format
    await db.track.create({
      data: {
        id: 'test-uuid-track',
        libraryId: library.id,
        name: 'test.mp3',
        path: 'dummy/test.mp3',
        format: 'mp3',
        artists: JSON.stringify([{ id: artistId, name: 'Original Name', role: 'Main Artist' }])
      }
    });
    
    // 4. Perform update via service (which we will implement)
    const musicService = require('../server/service/musicService');
    const updateResult = await musicService.updateArtist(artistId, {
      name: 'New Name',
      metadata: { birthPlace: 'Taipei', links: ['https://example.com'] }
    });
    
    if (!updateResult.success) {
      console.error('FAIL: Service update failed', updateResult.message || updateResult.error);
      exitCode = 1;
      return;
    }
    
    // 5. Verify name sync in Track
    const updatedTrack = await db.track.findFirst({ where: { id: 'test-uuid-track' } });
    if (!updatedTrack) {
      console.error('FAIL: Track not found');
      exitCode = 1;
      return;
    }
    
    const boundArtists = JSON.parse(updatedTrack.artists);
    if (boundArtists[0].name !== 'New Name') {
      console.error('FAIL: Track artist name was not synchronized', updatedTrack.artists);
      exitCode = 1;
      return;
    }
    
    // 6. Verify artist details in db
    const updatedArtist = await db.artist.findUnique({ where: { id: artistId } });
    if (!updatedArtist || updatedArtist.name !== 'New Name' || !updatedArtist.metadata.includes('Taipei')) {
      console.error('FAIL: Artist name or metadata was not updated in db', updatedArtist);
      exitCode = 1;
      return;
    }
    
    console.log('PASS: Artist CRUD and sync works');
  } catch (e) {
    console.error('FAIL: Unexpected test run error', e.message);
    exitCode = 1;
  } finally {
    await disconnectDatabase();
    cleanupDbFiles();
    process.exit(exitCode);
  }
}

runTest();
