import { connect } from '@tidbcloud/serverless';
import fs from 'fs';
import path from 'path';

type TiDBConnection = ReturnType<typeof connect>;

let client: TiDBConnection | null = null;
let tablesInitialized = false;

export function isTiDBConfigured(): boolean {
  return !!(process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL);
}

export function getTiDBClient(): TiDBConnection | null {
  const dbUrl = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
  if (!dbUrl) return null;

  if (!client) {
    try {
      client = connect({ url: dbUrl });
    } catch (err) {
      console.error('Failed to initialize TiDB Serverless client:', err);
      return null;
    }
  }
  return client;
}

/**
 * Execute SQL on TiDB Cloud Serverless
 */
export async function executeTiDB<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = getTiDBClient();
  if (!db) {
    throw new Error('TiDB is not configured. Please set DATABASE_URL environment variable.');
  }
  const result = await db.execute(sql, params);
  return result as T[];
}

/**
 * Auto-initializes TiDB tables on startup or on demand
 */
export async function ensureTiDBTables(): Promise<boolean> {
  if (tablesInitialized) return true;
  const db = getTiDBClient();
  if (!db) return false;

  try {
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
    console.log('[TiDB] Tables verified and ready.');
    return true;
  } catch (err) {
    console.error('[TiDB] Error initializing tables:', err);
    return false;
  }
}

/**
 * Local filesystem fallback helper (used when DATABASE_URL is not set)
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
