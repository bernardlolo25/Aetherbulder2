import { connect } from '@tidbcloud/serverless';
import fs from 'fs';
import path from 'path';

type TiDBConnection = ReturnType<typeof connect>;

let client: TiDBConnection | null = null;
let tablesInitialized = false;

// Circuit breaker to avoid flooding logs and failing requests if credentials are wrong
let authErrorDetected = false;
let lastAuthErrorTime = 0;
const AUTH_RETRY_INTERVAL_MS = 60000; // 1 minute backoff for Error 1045

/**
 * Normalizes DATABASE_URL to guarantee it connects to a writable database
 * (defaults to 'test' if database path is omitted or points to 'sys')
 */
export function normalizeDatabaseUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  try {
    const u = new URL(rawUrl);
    const dbName = (u.pathname || '').replace(/^\//, '').trim();
    if (
      !dbName ||
      dbName.toLowerCase() === 'sys' ||
      dbName.toLowerCase() === 'information_schema' ||
      dbName.toLowerCase() === 'mysql' ||
      dbName.toLowerCase() === 'performance_schema'
    ) {
      const targetDb = process.env.TIDB_DATABASE || 'test';
      u.pathname = '/' + targetDb;
      return u.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

export function isTiDBConfigured(): boolean {
  return !!(
    process.env.DATABASE_URL || 
    process.env.TIDB_DATABASE_URL ||
    (process.env.TIDB_HOST && (process.env.TIDB_USER || process.env.TIDB_USERNAME))
  );
}

export function resetTiDBClient(): void {
  client = null;
  authErrorDetected = false;
  lastAuthErrorTime = 0;
  tablesInitialized = false;
}

export function getTiDBClient(): TiDBConnection | null {
  if (client) return client;

  const rawUrl = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
  const host = process.env.TIDB_HOST;
  const username = process.env.TIDB_USER || process.env.TIDB_USERNAME;
  const password = process.env.TIDB_PASSWORD || '';
  const rawDb = process.env.TIDB_DATABASE || 'test';
  const cleanDb = (!rawDb || rawDb.toLowerCase() === 'sys') ? 'test' : rawDb;

  try {
    if (rawUrl) {
      const fixedUrl = normalizeDatabaseUrl(rawUrl);
      client = connect({ url: fixedUrl });
      console.log('[TiDB] Initialized via DATABASE_URL to database:', fixedUrl.replace(/:[^:@]+@/, ':****@'));
    } else if (host && username) {
      client = connect({
        host,
        username,
        password,
        database: cleanDb
      });
      console.log(`[TiDB] Initialized via individual env vars: Host=${host}, User=${username}, DB=${cleanDb}`);
    } else {
      return null;
    }
  } catch (err) {
    console.error('Failed to initialize TiDB Serverless client:', err);
    return null;
  }

  return client;
}

/**
 * Execute SQL on TiDB Cloud Serverless with Error 1045 Circuit Breaker
 */
export async function executeTiDB<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (authErrorDetected && Date.now() - lastAuthErrorTime < AUTH_RETRY_INTERVAL_MS) {
    throw new Error('TiDB authentication paused due to invalid password (Error 1045). Using local fallback store.');
  }

  const db = getTiDBClient();
  if (!db) {
    throw new Error('TiDB is not configured. Please set DATABASE_URL or TIDB_HOST/TIDB_USER/TIDB_PASSWORD.');
  }

  try {
    const result = await db.execute(sql, params);
    authErrorDetected = false; // Reset circuit breaker on success
    return result as T[];
  } catch (err: any) {
    if (err?.message?.includes('1045') || err?.message?.includes('Access denied')) {
      authErrorDetected = true;
      lastAuthErrorTime = Date.now();
      console.warn('[TiDB Auth Notice] Error 1045: Access denied for user (incorrect password). Running in local fallback storage mode until password is updated.');
    }
    throw err;
  }
}

/**
 * Auto-initializes TiDB tables on startup or on demand
 */
export async function ensureTiDBTables(): Promise<boolean> {
  if (tablesInitialized) return true;
  if (authErrorDetected && Date.now() - lastAuthErrorTime < AUTH_RETRY_INTERVAL_MS) {
    return false;
  }

  const db = getTiDBClient();
  if (!db) return false;

  try {
    const targetDb = process.env.TIDB_DATABASE || 'test';
    try {
      await db.execute(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\`;`);
      await db.execute(`USE \`${targetDb}\`;`);
    } catch (e: any) {
      if (e?.message?.includes('1045') || e?.message?.includes('Access denied')) {
        authErrorDetected = true;
        lastAuthErrorTime = Date.now();
        console.warn('[TiDB Auth Notice] Password authentication failed. Tables will be initialized once valid credentials are provided.');
        return false;
      }
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS aether_sites (
        id VARCHAR(64) PRIMARY KEY,
        site_name VARCHAR(255) DEFAULT 'Aether Site',
        data JSON NOT NULL,
        version INT DEFAULT 1,
        updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS aether_submissions (
        id VARCHAR(64) PRIMARY KEY,
        submitted_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
        is_read TINYINT(1) DEFAULT 0,
        type VARCHAR(50) DEFAULT 'contact',
        name VARCHAR(255) DEFAULT 'Anonymous',
        email VARCHAR(255) DEFAULT '',
        phone VARCHAR(100) DEFAULT '',
        page VARCHAR(100) DEFAULT 'home',
        message TEXT,
        extra JSON,
        INDEX idx_submitted_at (submitted_at),
        INDEX idx_is_read (is_read),
        INDEX idx_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS aether_revisions (
        id VARCHAR(64) PRIMARY KEY,
        saved_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
        formatted_date VARCHAR(100),
        site_name VARCHAR(255) DEFAULT 'Aether Site',
        page_count INT DEFAULT 1,
        total_sections INT DEFAULT 0,
        size_bytes INT DEFAULT 0,
        label VARCHAR(255) DEFAULT 'Auto-save',
        snapshot JSON NOT NULL,
        INDEX idx_saved_at (saved_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS aether_addons (
        id VARCHAR(64) PRIMARY KEY,
        data JSON NOT NULL,
        updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS aether_templates (
        id VARCHAR(64) PRIMARY KEY,
        data JSON NOT NULL,
        updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS aether_assets (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        url TEXT NOT NULL,
        size INT DEFAULT 0,
        ext VARCHAR(20) DEFAULT '',
        mime_type VARCHAR(100) DEFAULT '',
        data_base64 LONGTEXT,
        uploaded_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_uploaded_at (uploaded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS aether_config (
        key_name VARCHAR(100) PRIMARY KEY,
        value_data JSON NOT NULL,
        updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    tablesInitialized = true;
    authErrorDetected = false;
    console.log('[TiDB] Tables verified and ready in database:', targetDb);
    return true;
  } catch (err: any) {
    if (err?.message?.includes('1045') || err?.message?.includes('Access denied')) {
      authErrorDetected = true;
      lastAuthErrorTime = Date.now();
      console.warn('[TiDB Auth Notice] Password incorrect for TiDB user. Bypassing table init until credentials are updated.');
    } else {
      console.error('[TiDB] Error initializing tables:', err.message);
    }
    return false;
  }
}

/**
 * Local filesystem fallback helper (used when DATABASE_URL is not set or fails)
 */
export function readLocalJson<T = any>(relPath: string, defaultValue: T): T {
  try {
    const fullPath = path.join(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.warn(`[LocalStore] Failed to read ${relPath}:`, err);
  }
  return defaultValue;
}

export function writeLocalJson(relPath: string, data: any): void {
  try {
    const fullPath = path.join(process.cwd(), relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[LocalStore] Failed to write ${relPath}:`, err);
  }
}
