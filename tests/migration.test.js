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

const testDbPath = path.join(__dirname, 'test.db');
const testDbJournalPath = testDbPath + '-journal';

function cleanupDbFiles() {
  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDbJournalPath)) {
      fs.unlinkSync(testDbJournalPath);
    }
  } catch (e) {
    console.warn('Warning: cleanup db files failed:', e.message);
  }
}

async function runTest() {
  // 1. Clean up before test
  cleanupDbFiles();

  let exitCode = 0;
  try {
    // 2. Initialize and migrate using test database
    initDatabase(testDbPath);
    await autoMigrate();
    const db = getDb();
    
    console.log('Testing table and column availability...');
    
    // Check if Artist table exists
    try {
      await db.artist.count();
      console.log('Artist table exists');
    } catch (e) {
      console.error('FAIL: Artist table does not exist', e.message);
      exitCode = 1;
      return;
    }
    
    // Check if Track table has artists column
    try {
      // Force column resolution and prevent a false-positive pass if the database starts empty
      await db.track.findFirst({ select: { artists: true } });
      console.log('Track has artists column');
    } catch (e) {
      console.error('FAIL: Column check failed', e.message);
      exitCode = 1;
      return;
    }
  } catch (error) {
    console.error('FAIL: Unexpected test run error', error.message);
    exitCode = 1;
  } finally {
    // 3. Disconnect and clean up after test
    await disconnectDatabase();
    cleanupDbFiles();
    process.exit(exitCode);
  }
}

runTest();
