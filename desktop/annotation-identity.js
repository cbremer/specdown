// Read-issued source identity, separate from permission grants and note storage.
// No user-file probes. The caller must have completed an authorized content read.
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const identityUUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const grantKeyValid = (key) =>
  typeof key === 'string' &&
  (identityUUID.test(key) || /^legacy-[0-9a-f]{64}$/.test(key));
const IDENTITY_VERSION = 2;
const identitySchema = {
  authority: [['id', 'TEXT', 0]],
  sources: [
    ['location', 'TEXT', 1],
    ['token', 'TEXT', 0],
  ],
  file_sources: [
    ['grant_key', 'TEXT', 1],
    ['token', 'TEXT', 0],
    ['location', 'TEXT', 0],
    ['quarantined', 'INTEGER', 0],
    ['history', 'TEXT', 0],
  ],
  file_locations: [
    ['location', 'TEXT', 1],
    ['grant_key', 'TEXT', 0],
    ['collision', 'INTEGER', 0],
  ],
};
function createAnnotationIdentity(
  filename,
  { platform = process.platform } = {}
) {
  let db = null,
    unavailable = false;
  const marker = filename + '.enrolled';
  const validLocation = (location) =>
    typeof location === 'string' &&
    path.isAbsolute(location) &&
    location.length <= 32768;
  function validate(database) {
    if (
      database.prepare('PRAGMA user_version').get().user_version !==
        IDENTITY_VERSION ||
      fs.statSync(filename).size > 16 * 1024 * 1024
    )
      throw Error('Unsupported identity registry');
    const tables = database
      .prepare(
        "SELECT name,type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'"
      )
      .all();
    if (
      tables.length !== Object.keys(identitySchema).length ||
      tables.some(
        (table) =>
          table.type !== 'table' || !Object.hasOwn(identitySchema, table.name)
      )
    )
      throw Error('Unknown registry schema');
    for (const [table, expected] of Object.entries(identitySchema)) {
      const columns = database.prepare(`PRAGMA table_info(${table})`).all();
      if (
        columns.length !== expected.length ||
        columns.some(
          (column, index) =>
            column.name !== expected[index][0] ||
            column.type !== expected[index][1] ||
            column.pk !== expected[index][2]
        )
      )
        throw Error('Unknown identity columns');
    }
    const authorities = database.prepare('SELECT id FROM authority').all();
    if (
      authorities.length !== 1 ||
      typeof authorities[0].id !== 'string' ||
      !identityUUID.test(authorities[0].id)
    )
      throw Error('Invalid identity authority');
    const direct = database.prepare('SELECT location,token FROM sources').all(),
      files = database.prepare('SELECT * FROM file_sources').all(),
      locations = database.prepare('SELECT * FROM file_locations').all();
    if (direct.length + files.length + locations.length > 10000)
      throw Error('Identity record capacity exceeded');
    let bytes = 0,
      historyCount = 0;
    const directLocations = new Set(),
      keys = new Set(),
      activeLocations = new Set();
    for (const row of direct) {
      if (
        !validLocation(row.location) ||
        typeof row.token !== 'string' ||
        !identityUUID.test(row.token) ||
        directLocations.has(row.location)
      )
        throw Error('Invalid logical identity');
      directLocations.add(row.location);
      bytes += Buffer.byteLength(row.location, 'utf8');
    }
    for (const row of files) {
      if (
        !grantKeyValid(row.grant_key) ||
        keys.has(row.grant_key) ||
        !validLocation(row.location) ||
        !identityUUID.test(row.token) ||
        ![0, 1].includes(row.quarantined) ||
        typeof row.history !== 'string' ||
        row.history.length > 4 * 1024 * 1024
      )
        throw Error('Invalid bookmark identity');
      keys.add(row.grant_key);
      const history = JSON.parse(row.history);
      if (!Array.isArray(history)) throw Error('Invalid bookmark history');
      for (const entry of history) {
        if (
          !entry ||
          !validLocation(entry.location) ||
          typeof entry.token !== 'string' ||
          !identityUUID.test(entry.token)
        )
          throw Error('Invalid bookmark history');
        historyCount++;
      }
      bytes += Buffer.byteLength(
        row.location + row.history + row.grant_key,
        'utf8'
      );
    }
    for (const row of locations) {
      if (
        !validLocation(row.location) ||
        activeLocations.has(row.location) ||
        ![0, 1].includes(row.collision) ||
        (row.grant_key !== null && !keys.has(row.grant_key))
      )
        throw Error('Invalid locator registry');
      activeLocations.add(row.location);
      bytes += Buffer.byteLength(row.location, 'utf8');
    }
    if (bytes > 4 * 1024 * 1024 || historyCount > 10000)
      throw Error('Identity history capacity exceeded');
    return authorities[0].id;
  }
  function enroll(id) {
    if (fs.existsSync(marker)) {
      if (fs.statSync(marker).size > 1024) throw Error('Invalid marker');
      const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
      if (saved.version !== 1 || saved.authorityId !== id)
        throw Error('Enrollment mismatch');
      return;
    }
    let fd;
    try {
      fd = fs.openSync(marker, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify({ version: 1, authorityId: id }));
      fs.fsyncSync(fd);
      if (platform !== 'win32') {
        const directory = fs.openSync(path.dirname(marker), 'r');
        try {
          fs.fsyncSync(directory);
        } finally {
          fs.closeSync(directory);
        }
      }
    } catch (error) {
      if (error.code === 'EEXIST') return enroll(id);
      throw error;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }
  function open() {
    if (unavailable) return null;
    if (db) return db;
    try {
      const existedBefore = fs.existsSync(filename);
      if (fs.existsSync(marker) && !existedBefore)
        throw Error('Enrolled registry missing');
      const { DatabaseSync } = require('node:sqlite');
      db = new DatabaseSync(filename);
      db.exec(
        'PRAGMA busy_timeout=2000; PRAGMA synchronous=FULL; BEGIN IMMEDIATE'
      );
      const version = db.prepare('PRAGMA user_version').get().user_version;
      if (version === 0) {
        if (existedBefore) throw Error('Preexisting empty identity registry');
        if (
          db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
            .length
        )
          throw Error('Unknown registry');
        db.exec(
          'CREATE TABLE authority(id TEXT NOT NULL); CREATE TABLE sources(location TEXT PRIMARY KEY,token TEXT NOT NULL); CREATE TABLE file_sources(grant_key TEXT PRIMARY KEY,token TEXT NOT NULL,location TEXT NOT NULL,quarantined INTEGER NOT NULL,history TEXT NOT NULL); CREATE TABLE file_locations(location TEXT PRIMARY KEY,grant_key TEXT,collision INTEGER NOT NULL); PRAGMA user_version=2;'
        );
        db.prepare('INSERT INTO authority(id) VALUES (?)').run(randomUUID());
      } else if (version !== IDENTITY_VERSION)
        throw Error('Unsupported registry');
      const id = validate(db);
      db.exec('COMMIT');
      enroll(id);
      return db;
    } catch {
      try {
        db?.exec('ROLLBACK');
      } catch {}
      try {
        db?.close();
      } catch {}
      db = null;
      unavailable = true;
      return null;
    }
  }
  function fileIdentity(database, location, key) {
    let source = database
      .prepare('SELECT * FROM file_sources WHERE grant_key=?')
      .get(key);
    const previousLocation = source?.location;
    if (source && previousLocation !== location) {
      const history = JSON.parse(source.history);
      history.push({ location: previousLocation, token: source.token });
      source.history = JSON.stringify(history);
      database
        .prepare(
          'UPDATE file_locations SET grant_key=NULL WHERE location=? AND grant_key=?'
        )
        .run(previousLocation, key);
    }
    const destination = database
      .prepare('SELECT * FROM file_locations WHERE location=?')
      .get(location);
    const collision =
      destination?.collision === 1 ||
      (destination?.grant_key && destination.grant_key !== key);
    if (!source) {
      source = {
        grant_key: key,
        token: randomUUID(),
        location,
        quarantined: 0,
        history: '[]',
      };
      database
        .prepare('INSERT INTO file_sources VALUES(?,?,?,?,?)')
        .run(key, source.token, location, 0, '[]');
    }
    if (collision) {
      const affected = database
        .prepare('SELECT * FROM file_sources WHERE location=? OR grant_key=?')
        .all(location, key);
      for (const row of affected) {
        if (row.location === location && row.quarantined === 1) continue;
        const history = JSON.parse(
          row.grant_key === key ? source.history : row.history
        );
        history.push({ location: row.location, token: row.token });
        database
          .prepare(
            'UPDATE file_sources SET token=?,quarantined=1,history=? WHERE grant_key=?'
          )
          .run(randomUUID(), JSON.stringify(history), row.grant_key);
      }
      database
        .prepare(
          'INSERT INTO file_locations VALUES(?,NULL,1) ON CONFLICT(location) DO UPDATE SET grant_key=NULL,collision=1'
        )
        .run(location);
      database
        .prepare('UPDATE file_sources SET location=? WHERE grant_key=?')
        .run(location, key);
    } else {
      database
        .prepare(
          'UPDATE file_sources SET location=?,quarantined=0,history=? WHERE grant_key=?'
        )
        .run(location, source.history, key);
      database
        .prepare(
          'INSERT INTO file_locations VALUES(?,?,0) ON CONFLICT(location) DO UPDATE SET grant_key=excluded.grant_key,collision=0'
        )
        .run(location, key);
    }
    const result = database
      .prepare('SELECT token,quarantined FROM file_sources WHERE grant_key=?')
      .get(key);
    return {
      sourceToken: result.token,
      requiresReconnect: result.quarantined === 1,
    };
  }
  return {
    afterAuthorizedRead(location, continuity = {}) {
      if (!validLocation(location) || continuity.ephemeral) return null;
      const database = open();
      if (!database) return null;
      try {
        database.exec('BEGIN IMMEDIATE');
        const authorityId = validate(database);
        enroll(authorityId);
        let descriptor;
        if (continuity.sourceKind === 'file-bookmark') {
          if (!grantKeyValid(continuity.grantKey))
            throw Error('Missing bookmark continuity key');
          descriptor = fileIdentity(database, location, continuity.grantKey);
        } else {
          let row = database
            .prepare('SELECT token FROM sources WHERE location=?')
            .get(location);
          if (!row) {
            row = { token: randomUUID() };
            database
              .prepare('INSERT INTO sources VALUES(?,?)')
              .run(location, row.token);
          }
          descriptor = { sourceToken: row.token };
        }
        validate(database);
        database.exec('COMMIT');
        return { authorityId, ...descriptor };
      } catch {
        try {
          database.exec('ROLLBACK');
        } catch {}
        return null;
      }
    },
    close() {
      try {
        db?.close();
      } catch {}
      db = null;
      unavailable = true;
    },
  };
}
module.exports = { createAnnotationIdentity };
