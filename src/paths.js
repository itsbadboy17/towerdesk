// Location of TowerDesk's private data (login hashes, encryption key, saved devices).
// TOWERDESK_DATA_DIR overrides it, e.g. for tests.
const path = require('path');

function dataDir() {
  return process.env.TOWERDESK_DATA_DIR || path.join(__dirname, '..', 'data');
}

module.exports = { dataDir };
