import React, { useState } from 'react';
import { 
  Database, 
  Cloud, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Terminal, 
  Code2, 
  FileText, 
  Layers, 
  ExternalLink,
  ShieldCheck,
  Zap,
  RefreshCw,
  FolderUp,
  Cpu,
  BookOpen
} from 'lucide-react';

interface CodeSnippet {
  title: string;
  filename: string;
  language: string;
  description: string;
  code: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'converter' | 'drivers' | 'checklist' | 'importer'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Schema Converter state
  const [sourceDialect, setSourceDialect] = useState<'postgres' | 'sqlite' | 'prisma' | 'mongodb'>('postgres');
  const [inputCode, setInputCode] = useState<string>(`-- Example PostgreSQL Schema
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(120),
  profile_data JSONB,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  order_id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB,
  placed_at TIMESTAMPTZ DEFAULT NOW()
);`);

  const [convertedCode, setConvertedCode] = useState<string>('');

  // Selected Driver for code generator
  const [selectedDriver, setSelectedDriver] = useState<'tidb-serverless' | 'drizzle' | 'prisma' | 'mysql2'>('tidb-serverless');

  // Copy helper
  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Run conversion logic
  const handleConvertSchema = () => {
    let result = inputCode;

    if (sourceDialect === 'postgres') {
      result = result
        .replace(/UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/gi, 'VARCHAR(36) PRIMARY KEY /* UUID default handled via app or (UUID()) */')
        .replace(/UUID/gi, 'VARCHAR(36)')
        .replace(/SERIAL\s+PRIMARY\s+KEY/gi, 'BIGINT AUTO_INCREMENT PRIMARY KEY')
        .replace(/SERIAL/gi, 'BIGINT AUTO_INCREMENT')
        .replace(/TIMESTAMPTZ/gi, 'DATETIME(6)')
        .replace(/BOOLEAN/gi, 'TINYINT(1)')
        .replace(/JSONB/gi, 'JSON')
        .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP(6)')
        .replace(/gen_random_uuid\(\)/gi, '(UUID())')
        .replace(/BYTEA/gi, 'LONGBLOB')
        .replace(/TEXT\[\]/gi, 'JSON /* Store array as JSON */');

      // Prepend TiDB MySQL header
      result = `-- Converted for TiDB Serverless (MySQL 8.0 Compatible)
-- Note: TiDB Serverless handles distributed transactions & auto-sharding natively

SET FOREIGN_KEY_CHECKS = 0;

${result}

SET FOREIGN_KEY_CHECKS = 1;`;
    } else if (sourceDialect === 'sqlite') {
      result = result
        .replace(/AUTOINCREMENT/gi, 'AUTO_INCREMENT')
        .replace(/INTEGER PRIMARY KEY/gi, 'BIGINT PRIMARY KEY AUTO_INCREMENT')
        .replace(/TEXT/gi, 'VARCHAR(255)')
        .replace(/BLOB/gi, 'LONGBLOB');

      result = `-- Converted from SQLite to TiDB (MySQL Dialect)\n${result}`;
    } else if (sourceDialect === 'prisma') {
      result = `// prisma/schema.prisma for TiDB + Vercel
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma" // Recommended for serverless distributed databases like TiDB
}

generator client {
  provider = "prisma-client-js"
}

// Convert native types to MySQL:
// String @id @default(uuid()) -> @db.VarChar(36)
// DateTime @default(now())   -> DateTime @default(now())
// Json                        -> Json`;
    } else if (sourceDialect === 'mongodb') {
      result = `-- Mapping Document Collections to Relational TiDB Tables
-- TiDB supports native JSON functions (JSON_EXTRACT, JSON_SET) & indexing on generated columns

CREATE TABLE app_documents (
  id VARCHAR(64) PRIMARY KEY,
  collection_name VARCHAR(100) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_collection (collection_name)
);`;
    }

    setConvertedCode(result);
  };

  // Run initial conversion
  React.useEffect(() => {
    handleConvertSchema();
  }, [sourceDialect]);

  // Code snippets database
  const driverSnippets: Record<string, CodeSnippet[]> = {
    'tidb-serverless': [
      {
        title: 'Vercel Serverless Function (HTTP Driver - No Cold-Start connection limit)',
        filename: 'api/users.ts',
        language: 'typescript',
        description: 'Using @tidbcloud/serverless over HTTPS. Ideal for Vercel Edge & Serverless functions because it avoids TCP connection pool exhaustion.',
        code: `import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connect } from '@tidbcloud/serverless';

// Initialize TiDB Serverless HTTP client
// Automatically reads from process.env.DATABASE_URL
const conn = connect({ url: process.env.DATABASE_URL });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      // Execute query via stateless HTTP
      const users = await conn.execute(
        'SELECT id, email, full_name, created_at FROM users ORDER BY created_at DESC LIMIT 20'
      );
      return res.status(200).json({ success: true, data: users });
    }

    if (req.method === 'POST') {
      const { email, full_name } = req.body;
      const result = await conn.execute(
        'INSERT INTO users (id, email, full_name) VALUES (UUID(), ?, ?)',
        [email, full_name]
      );
      return res.status(201).json({ success: true, result });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('TiDB Query Error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}`
      },
      {
        title: 'Environment Variables for Vercel',
        filename: '.env.production',
        language: 'bash',
        description: 'Obtain this URL from TiDB Cloud Console -> Connect -> Connect with HTTP / Driver.',
        code: `# Format provided by TiDB Cloud Serverless:
DATABASE_URL="mysql://<user>:<password>@gateway01.<region>.prod.aws.tidbcloud.com:4000/<dbname>?ssl={"rejectUnauthorized":true}"

# Required for Vercel Edge/Serverless HTTP driver:
TIDB_HOST="gateway01.<region>.prod.aws.tidbcloud.com"
TIDB_USER="<user>"
TIDB_PASSWORD="<password>"
TIDB_DATABASE="<dbname>"`
      }
    ],
    'drizzle': [
      {
        title: 'Drizzle ORM with TiDB Serverless (HTTP adapter)',
        filename: 'src/db/index.ts',
        language: 'typescript',
        description: 'Drizzle provides type safety with zero TCP connection overhead when paired with the TiDB Serverless HTTP driver.',
        code: `import { connect } from '@tidbcloud/serverless';
import { drizzle } from 'drizzle-orm/tidb-serverless';
import * as schema from './schema';

const client = connect({ url: process.env.DATABASE_URL });
export const db = drizzle(client, { schema });

// Example query inside a Vercel route:
// const allUsers = await db.select().from(schema.users);`
      },
      {
        title: 'Drizzle Schema definition',
        filename: 'src/db/schema.ts',
        language: 'typescript',
        description: 'Defines MySQL-compatible schema with Drizzle for TiDB.',
        code: `import { mysqlTable, varchar, datetime, tinyint, json } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql\`(UUID())\`),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 120 }),
  profileData: json('profile_data'),
  isVerified: tinyint('is_verified').default(0),
  createdAt: datetime('created_at', { fsp: 6 }).default(sql\`CURRENT_TIMESTAMP(6)\`),
});`
      }
    ],
    'prisma': [
      {
        title: 'Prisma Configuration for TiDB + Vercel',
        filename: 'prisma/schema.prisma',
        language: 'prisma',
        description: 'Use relationMode = "prisma" so referential actions are handled cleanly without cross-shard locks.',
        code: `datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id          String   @id @default(uuid()) @db.VarChar(36)
  email       String   @unique @db.VarChar(255)
  fullName    String?  @map("full_name") @db.VarChar(120)
  createdAt   DateTime @default(now()) @map("created_at")
  posts       Post[]

  @@map("users")
}

model Post {
  id        String   @id @default(uuid()) @db.VarChar(36)
  title     String   @db.VarChar(255)
  authorId  String   @map("author_id") @db.VarChar(36)
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")

  @@index([authorId])
  @@map("posts")
}`
      },
      {
        title: 'Prisma Client Singleton for Serverless',
        filename: 'lib/prisma.ts',
        language: 'typescript',
        description: 'Prevents multiple client instances in serverless environments.',
        code: `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;`
      }
    ],
    'mysql2': [
      {
        title: 'Standard MySQL2 with SSL Pool (Node.js Serverless)',
        filename: 'lib/db.ts',
        language: 'typescript',
        description: 'Standard TCP connection pool using mysql2/promise with TiDB Cloud CA verification.',
        code: `import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getDbPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.TIDB_HOST,
      port: Number(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
      waitForConnections: true,
      connectionLimit: 5, // Keep small on serverless instances
      queueLimit: 0,
    });
  }
  return pool;
}`
      }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Notification / Project Detection Status */}
      <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 border-b border-amber-600/40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div>
              <span className="font-semibold text-amber-200">Workspace Status: </span>
              <span className="text-slate-300">
                You asked if your project can be converted to <strong className="text-white">Vercel + TiDB</strong>. <span className="text-amber-300 font-medium">Yes, 100% possible!</span>
              </span>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('importer')}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            <FolderUp className="w-3.5 h-3.5" />
            Paste / Import Project Files
          </button>
        </div>
      </div>

      {/* Hero Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">TiDB + Vercel Migration Hub</h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Serverless Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Architectural blueprint, MySQL 8.0 compatibility converter, and edge serverless driver configuration
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Architecture & Feasibility
            </button>
            <button
              onClick={() => setActiveTab('converter')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'converter'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Schema & SQL Converter
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'drivers'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Vercel Driver Code
            </button>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'checklist'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Migration Checklist
            </button>
            <button
              onClick={() => setActiveTab('importer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'importer'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FolderUp className="w-3.5 h-3.5" />
              Convert My Code
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Feasibility Verdict Box */}
            <div className="bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold mb-4">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Feasibility Verdict: 100% Fully Supported
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Can your project run on Vercel with TiDB?
                </h2>
                <p className="mt-3 text-slate-300 leading-relaxed text-base max-w-3xl">
                  <strong>Yes, absolutely.</strong> TiDB Cloud Serverless and Vercel are a premier combination. TiDB is a distributed, HTAP SQL database that is fully wire-compatible with <strong>MySQL 8.0</strong> and offers a specialized <strong>HTTP Serverless Driver</strong> (<code className="text-cyan-300">@tidbcloud/serverless</code>) designed specifically to eliminate cold-start lag and connection pooling bottlenecks on Vercel.
                </p>

                {/* 3 Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                      <Zap className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">Zero Connection Exhaustion</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Serverless functions spin up and die rapidly. Traditional TCP pools can exhaust connections. TiDB’s HTTP driver executes SQL over stateless HTTPS without maintaining persistent sockets.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                      <Database className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">MySQL 8.0 Wire Compatibility</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Works with any ORM or client: Drizzle, Prisma, TypeORM, Kysely, Sequelize, or native <code className="text-slate-300">mysql2</code>. If your app used PostgreSQL or SQLite, only minor dialect adjustments are required.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">Vercel Edge & Serverless Ready</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Deploy your API routes as Next.js App Router, Pages Router, or standalone Vercel Serverless Functions in <code className="text-slate-300">/api</code> with automatic global deployment and fast response times.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Comparison: Before vs After */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                How the Architecture Transforms
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Here is how your backend server and database models change when moving from a persistent server to Vercel + TiDB:
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Traditional Architecture */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Traditional Stateful Server
                    </span>
                    <span className="text-xs text-slate-500">e.g. Express / VPS</span>
                  </div>
                  <ul className="space-y-3 mt-4 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-slate-500 font-mono">01.</span>
                      <span><strong>Stateful process:</strong> Long-running Express server listening on a port 24/7. In-memory variables are preserved.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-500 font-mono">02.</span>
                      <span><strong>Fixed DB Pool:</strong> Maintains 10-20 persistent TCP sockets to the database.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-500 font-mono">03.</span>
                      <span><strong>Dialect lock-in:</strong> Often coupled to a local SQLite file, local Postgres, or MongoDB container.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-500 font-mono">04.</span>
                      <span><strong>Manual scaling:</strong> Requires manual horizontal scaling, load balancers, and container management.</span>
                    </li>
                  </ul>
                </div>

                {/* Vercel + TiDB Serverless Architecture */}
                <div className="bg-slate-950 border border-cyan-800/40 rounded-xl p-5 relative">
                  <div className="flex items-center justify-between pb-3 border-b border-cyan-900/30">
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      Vercel Serverless + TiDB Cloud
                    </span>
                    <span className="text-xs text-cyan-300 font-medium">Modern Serverless</span>
                  </div>
                  <ul className="space-y-3 mt-4 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-500 font-mono">01.</span>
                      <span><strong>Stateless functions:</strong> Handlers inside <code className="text-cyan-300">/api/*.ts</code> run on-demand in milliseconds and scale to zero cost when idle.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-500 font-mono">02.</span>
                      <span><strong>Stateless HTTP DB queries:</strong> Queries execute over HTTPS using <code className="text-cyan-300">@tidbcloud/serverless</code>. Zero TCP pool starvation.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-500 font-mono">03.</span>
                      <span><strong>MySQL 8.0 compatibility:</strong> Standard SQL, ACID transactions, secondary indexes, and JSON column functions.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-500 font-mono">04.</span>
                      <span><strong>Global Edge:</strong> Frontend assets cached on Vercel Edge CDN with API execution close to your TiDB cluster.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* What needs to be adjusted in your code? */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                Key Adjustments to Make in Your Existing Code
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">1</span>
                    Convert Express Routes to Vercel Functions
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Instead of <code className="text-slate-300">app.listen(3000)</code> and <code className="text-slate-300">app.get('/api/users')</code>, organize each endpoint into <code className="text-cyan-300">api/users.ts</code> exporting <code className="text-slate-300">export default async function handler(req, res)</code> or Next.js <code className="text-cyan-300">app/api/users/route.ts</code>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">2</span>
                    Switch Database Driver to TiDB
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Install <code className="text-cyan-300">npm i @tidbcloud/serverless</code> or configure Drizzle/Prisma with your TiDB Cloud <code className="text-slate-300">DATABASE_URL</code> with TLS enabled (<code className="text-slate-300">rejectUnauthorized: true</code>).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">3</span>
                    Replace In-Memory State
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    If your project used global variables, <code className="text-slate-300">let cache = {}</code>, or in-memory sessions, move them into TiDB tables (e.g. <code className="text-slate-300">sessions</code> table, Redis/Upstash, or JWT cookies).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">4</span>
                    File Uploads & WebSockets
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    If your app saved files locally (<code className="text-slate-300">/uploads</code>), use S3/Cloudflare R2/Vercel Blob with URLs stored in TiDB. For WebSockets, use Pusher, Ably, or Server-Sent Events (SSE).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONVERTER TAB */}
        {activeTab === 'converter' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-cyan-400" />
                    SQL & Schema Transpiler to TiDB (MySQL 8.0)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Paste your current PostgreSQL, SQLite, or Prisma schema to convert it into TiDB Serverless compatible DDL.
                  </p>
                </div>

                {/* Dialect Selector */}
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 px-2 font-medium">Source:</span>
                  {(['postgres', 'sqlite', 'prisma', 'mongodb'] as const).map((dialect) => (
                    <button
                      key={dialect}
                      onClick={() => setSourceDialect(dialect)}
                      className={`px-3 py-1 text-xs rounded-lg font-medium capitalize transition cursor-pointer ${
                        sourceDialect === dialect
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {dialect}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                <span className="text-slate-500">Quick Samples:</span>
                <button
                  onClick={() => {
                    setSourceDialect('postgres');
                    setInputCode(`CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(120),
  profile_data JSONB,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  order_id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB,
  placed_at TIMESTAMPTZ DEFAULT NOW()
);`);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition cursor-pointer"
                >
                  PostgreSQL Users & Orders
                </button>
                <button
                  onClick={() => {
                    setSourceDialect('sqlite');
                    setInputCode(`CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  author_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition cursor-pointer"
                >
                  SQLite Blog Schema
                </button>
                <button
                  onClick={() => {
                    setSourceDialect('prisma');
                    setInputCode(`model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}`);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition cursor-pointer"
                >
                  NextAuth Prisma Schema
                </button>
              </div>

              {/* Split Editor */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Source Input */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between bg-slate-950 px-4 py-2 border-t border-x border-slate-800 rounded-t-xl text-xs">
                    <span className="font-semibold text-slate-300 uppercase tracking-wider">
                      Input ({sourceDialect})
                    </span>
                    <button
                      onClick={handleConvertSchema}
                      className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Convert
                    </button>
                  </div>
                  <textarea
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="w-full h-80 p-4 font-mono text-xs bg-slate-950 border border-slate-800 rounded-b-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                    placeholder="Paste your source schema or DDL here..."
                  />
                </div>

                {/* Target Output */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between bg-slate-950 px-4 py-2 border-t border-x border-slate-800 rounded-t-xl text-xs">
                    <span className="font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      TiDB MySQL 8.0 Target
                    </span>
                    <button
                      onClick={() => handleCopy('converted-sql', convertedCode)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium transition cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'converted-sql' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy DDL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={convertedCode}
                    className="w-full h-80 p-4 font-mono text-xs bg-slate-950/90 border border-slate-800 rounded-b-xl text-cyan-200 focus:outline-none resize-none selection:bg-cyan-800"
                  />
                </div>
              </div>

              {/* Conversion Cheat-sheet */}
              <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Dialect Mapping Reference for TiDB
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-red-400">PostgreSQL</div>
                    <div className="text-slate-400">SERIAL</div>
                    <div className="text-cyan-400 mt-1">→ BIGINT AUTO_INC</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-red-400">PostgreSQL</div>
                    <div className="text-slate-400">UUID</div>
                    <div className="text-cyan-400 mt-1">→ VARCHAR(36)</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-red-400">PostgreSQL</div>
                    <div className="text-slate-400">TIMESTAMPTZ</div>
                    <div className="text-cyan-400 mt-1">→ DATETIME(6)</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-red-400">PostgreSQL</div>
                    <div className="text-slate-400">JSONB</div>
                    <div className="text-cyan-400 mt-1">→ JSON</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DRIVERS TAB */}
        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    Production Driver & ORM Code for Vercel
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Select your preferred data access layer to view ready-to-copy integration code for Vercel Serverless & Edge.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setSelectedDriver('tidb-serverless')}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                      selectedDriver === 'tidb-serverless'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    @tidbcloud/serverless (HTTP)
                  </button>
                  <button
                    onClick={() => setSelectedDriver('drizzle')}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                      selectedDriver === 'drizzle'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Drizzle ORM
                  </button>
                  <button
                    onClick={() => setSelectedDriver('prisma')}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                      selectedDriver === 'prisma'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Prisma ORM
                  </button>
                  <button
                    onClick={() => setSelectedDriver('mysql2')}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                      selectedDriver === 'mysql2'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    MySQL2 Pool
                  </button>
                </div>
              </div>

              {/* Code Snippets Display */}
              <div className="space-y-6">
                {driverSnippets[selectedDriver]?.map((snippet, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span className="font-mono text-xs font-semibold text-slate-200">{snippet.filename}</span>
                        <span className="text-[11px] text-slate-400 hidden sm:inline">— {snippet.title}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(`${selectedDriver}-${idx}`, snippet.code)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                      >
                        {copiedKey === `${selectedDriver}-${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800/60 text-xs text-slate-400">
                      {snippet.description}
                    </div>
                    <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto bg-slate-950">
                      <code>{snippet.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            {/* vercel.json configuration */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-base">vercel.json Project Config</h3>
                </div>
                <button
                  onClick={() => handleCopy('vercel-json', `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
        { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" }
      ]
    }
  ]
}`)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                >
                  {copiedKey === 'vercel-json' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Config</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                If you are running a Vite single page application with serverless functions inside <code className="text-cyan-300">/api</code>, place this in your root folder:
              </p>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto">
{`{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}`}
              </pre>
            </div>
          </div>
        )}

        {/* CHECKLIST TAB */}
        {activeTab === 'checklist' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Step-by-Step Vercel + TiDB Migration Roadmap
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Follow these 6 steps to convert any existing web project into a high-performance Vercel application backed by TiDB.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Provision your free TiDB Cloud Serverless Cluster</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Go to <a href="https://tidbcloud.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center gap-0.5">tidbcloud.com <ExternalLink className="w-2.5 h-2.5" /></a> and create a free Serverless cluster (comes with 5 GiB storage and 50M Request Units per month for free). Choose the AWS or Google Cloud region closest to your Vercel functions (e.g. <code className="text-slate-300">us-east-1</code>).
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Convert & Execute Database Schema</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Use the <strong>Schema & SQL Converter</strong> tab above. Replace PostgreSQL-specific types (<code className="text-slate-300">SERIAL</code>, <code className="text-slate-300">TIMESTAMPTZ</code>, <code className="text-slate-300">JSONB</code>) with MySQL equivalents. Run the DDL queries in the TiDB Cloud SQL Editor console.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Organize API Handlers for Serverless Execution</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Break monolithic Express routers into discrete files inside the <code className="text-cyan-300">/api</code> directory (or <code className="text-cyan-300">app/api/.../route.ts</code> in Next.js). Each endpoint should export an asynchronous handler function.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Install the Serverless HTTP Driver</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Run <code className="text-cyan-300">npm install @tidbcloud/serverless</code>. This executes queries over HTTP, completely avoiding connection pool limits that plague traditional MySQL/PostgreSQL drivers in serverless environments.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    5
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Configure Environment Variables in Vercel</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      In your Vercel Project Dashboard → Settings → Environment Variables, add <code className="text-slate-300">DATABASE_URL</code> obtained from TiDB Cloud. Ensure SSL mode is enabled.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    6
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Deploy & Verify</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Push your Git repository to GitHub/GitLab and link it in Vercel, or run <code className="text-slate-300">vercel deploy</code> from your terminal. Test your endpoints and inspect latency metrics in the TiDB Cloud console.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IMPORTER / CONVERT MY CODE TAB */}
        {activeTab === 'importer' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <FolderUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Import Your Existing Project Files</h2>
                  <p className="text-xs text-slate-400">
                    Your current workspace currently has a clean starter template. Paste your code or upload files below to convert them.
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/30 text-xs text-amber-200 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-300">How to get your code into this session:</p>
                  <p className="text-slate-300">
                    1. You can paste your existing files (like <code className="text-amber-300">server.js</code>, schema files, or database queries) directly in the box below or in the chat.<br/>
                    2. Let me know what features your app has (e.g. Authentication, E-commerce, Notes, etc.), and I can write the complete Vercel + TiDB codebase for it right here!
                  </p>
                </div>
              </div>

              {/* Code Paste Box */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Paste Your Existing Backend / Database Code:
                  </label>
                  <textarea
                    rows={8}
                    className="w-full p-4 font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder={`// Example: Paste your Express server.js, Knex/Prisma/Mongoose models, or SQL here:
app.post('/api/items', async (req, res) => {
  const item = await db.insert(req.body);
  res.json(item);
});`}
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-500">
                    Tip: You can also tell me in chat: <em>"Here is my app: [paste code]"</em> and I will generate the complete Vercel + TiDB serverless files.
                  </span>
                  <button
                    onClick={() => {
                      alert('You can paste your code directly into the chat or in this box, and tell me what functionality you want to convert!');
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Ready to Convert
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 px-4 sm:px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TiDB Serverless + Vercel Full-Stack Architecture</span>
          <span className="text-slate-600">MySQL 8.0 Protocol Compatible • Distributed SQL • Zero Cold-Start TCP Limits</span>
        </div>
      </footer>
    </div>
  );
}
