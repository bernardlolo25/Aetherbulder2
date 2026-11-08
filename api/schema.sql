-- ==============================================================================
-- AETHERBUILDER - TiDB Cloud Serverless Schema
-- MySQL 8.0 Protocol Compatible & Distributed SQL
-- ==============================================================================

-- 1. Sites Table: Stores current published website state, pages, and components
CREATE TABLE IF NOT EXISTS aether_sites (
  id VARCHAR(64) PRIMARY KEY,
  site_name VARCHAR(255) DEFAULT 'Aether Site',
  data JSON NOT NULL,
  version INT DEFAULT 1,
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Submissions Table: Stores contact form leads, newsletter signups, bookings
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

-- 3. Revisions Table: Auto-save snapshots and version rollbacks
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

-- 4. Add-ons Table: Active and configured widget plugins
CREATE TABLE IF NOT EXISTS aether_addons (
  id VARCHAR(64) PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Templates Table: Custom and community templates
CREATE TABLE IF NOT EXISTS aether_templates (
  id VARCHAR(64) PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Media Assets Table: Uploaded images, media, and assets
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

-- 7. System Config & Auth Settings
CREATE TABLE IF NOT EXISTS aether_config (
  key_name VARCHAR(100) PRIMARY KEY,
  value_data JSON NOT NULL,
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Bookings & Appointments Table
CREATE TABLE IF NOT EXISTS aether_bookings (
  id VARCHAR(64) PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  booking_date DATETIME(6),
  service_name VARCHAR(255),
  details JSON,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
