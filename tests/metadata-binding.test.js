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

const testDbPath = path.join(__dirname, 'test-metadata.db');
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
  
  console.log('Testing Artist Metadata Parsing & Track Binding...');
  
  let exitCode = 0;
  
  try {
    // 1. Create a mock library
    const library = await db.musicLibrary.create({
      data: { id: 'test-lib-metadata', name: 'Test Library Metadata' }
    });
    
    // 2. Create track using musicDao.updateTrack / or simulate sync/import
    const musicDao = require('../server/dao/musicDao');
    
    // Create track initially
    const trackId = 'test-track-binding';
    await db.track.create({
      data: {
        id: trackId,
        libraryId: library.id,
        name: 'test.mp3',
        path: 'dummy/test.mp3',
        format: 'mp3',
        artist: 'Jay Chou', // Initial artist name
      }
    });

    // 3. Trigger buildArtistsJson / updateTrack to parse the initial artist name
    const updateResult = await musicDao.updateTrack(trackId, { artist: 'Jay Chou / Jolin Tsai' });
    if (!updateResult.success) {
      console.error('FAIL: updateTrack failed', updateResult.error);
      exitCode = 1;
      return;
    }

    // 4. Verify track artists JSON column has been populated
    const updatedTrack = await db.track.findFirst({ where: { id: trackId } });
    if (!updatedTrack || !updatedTrack.artists) {
      console.error('FAIL: artists field is empty', updatedTrack);
      exitCode = 1;
      return;
    }

    const boundArtists = JSON.parse(updatedTrack.artists);
    if (boundArtists.length !== 2) {
      console.error('FAIL: Expected 2 bound artists, got', boundArtists);
      exitCode = 1;
      return;
    }

    // Verify roles and names
    if (boundArtists[0].name !== 'Jay Chou' || boundArtists[0].role !== 'Main Artist') {
      console.error('FAIL: First artist details incorrect', boundArtists[0]);
      exitCode = 1;
      return;
    }
    if (boundArtists[1].name !== 'Jolin Tsai' || boundArtists[1].role !== 'Main Artist') {
      console.error('FAIL: Second artist details incorrect', boundArtists[1]);
      exitCode = 1;
      return;
    }

    // 5. Verify the artists are created in artists table
    const artist1 = await db.artist.findFirst({ where: { name: 'Jay Chou' } });
    const artist2 = await db.artist.findFirst({ where: { name: 'Jolin Tsai' } });
    if (!artist1 || !artist2) {
      console.error('FAIL: Artists not created in database', artist1, artist2);
      exitCode = 1;
      return;
    }

    // Verify IDs in JSON match database IDs
    if (boundArtists[0].id !== artist1.id || boundArtists[1].id !== artist2.id) {
      console.error('FAIL: JSON artist IDs do not match database artist IDs', boundArtists, artist1, artist2);
      exitCode = 1;
      return;
    }

    console.log('PASS: Artist metadata parsing & track binding test passed');
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
