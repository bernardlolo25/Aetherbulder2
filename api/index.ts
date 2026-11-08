import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  isTiDBConfigured, 
  getTiDBClient, 
  executeTiDB, 
  ensureTiDBTables, 
  readLocalJson, 
  writeLocalJson 
} from './db.ts';
import fs from 'fs';
import path from 'path';

// CORS configuration for Vercel Serverless
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE,PUT',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Password,Authorization,X-Requested-With'
};

function sendJson(res: VercelResponse, statusCode: number, data: any) {
  Object.entries(CORS_HEADERS).forEach(([key, val]) => res.setHeader(key, val));
  res.setHeader('Content-Type', 'application/json');
  return res.status(statusCode).json(data);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([key, val]) => res.setHeader(key, val));
    return res.status(204).end();
  }

  // Parse action from query parameter or body
  const action = (req.query.action as string) || (req.body && req.body.action) || '';
  const useTiDB = isTiDBConfigured();

  // Try to auto-initialize TiDB tables if configured
  if (useTiDB) {
    await ensureTiDBTables().catch((err) => console.warn('[TiDB Init Warning]', err.message));
  }

  try {
    // ── 1. DB Initialization / Diagnostic Status ─────────────────────────────
    if (action === 'init_db' || action === 'db_status') {
      const isReady = useTiDB ? await ensureTiDBTables() : false;
      return sendJson(res, 200, {
        success: true,
        tidb_configured: useTiDB,
        tables_ready: isReady,
        storage_engine: useTiDB ? 'TiDB Serverless (MySQL 8.0)' : 'Local File Fallback',
        timestamp: new Date().toISOString()
      });
    }

    // ── 2. Auth: login & verify_session ──────────────────────────────────────
    if (action === 'login' || action === 'verify_session') {
      const devToken = 'aether_sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      return sendJson(res, 200, { success: true, token: devToken, authenticated: true });
    }

    // ── 3. GET: get_site ─────────────────────────────────────────────────────
    if (action === 'get_site') {
      if (useTiDB) {
        try {
          const rows = await executeTiDB<{ data: any }>(
            'SELECT data FROM aether_sites WHERE id = ? LIMIT 1',
            ['default']
          );
          if (rows && rows.length > 0) {
            const rawData = rows[0].data;
            const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            return sendJson(res, 200, parsed);
          }
        } catch (dbErr: any) {
          if (!dbErr?.message?.includes('1045') && !dbErr?.message?.includes('Access denied')) {
            console.warn('[TiDB get_site]', dbErr.message);
          }
        }
      }

      // Fallback: local data/site.json
      const localSite = readLocalJson('data/site.json', null);
      if (localSite) {
        return sendJson(res, 200, localSite);
      }
      return sendJson(res, 200, { 
        siteSettings: { siteTitle: 'New Aether Site' },
        pages: [{ id: 'p_home', title: 'Home', slug: 'home', sections: [] }] 
      });
    }

    // ── 4. POST: publish ─────────────────────────────────────────────────────
    if (action === 'publish') {
      const siteData = req.body;
      if (!siteData) {
        return sendJson(res, 400, { error: 'No payload provided for publish' });
      }

      const siteTitle = siteData.siteSettings?.siteTitle || siteData.siteName || 'Aether Site';
      const pagesCount = Array.isArray(siteData.pages) ? siteData.pages.length : 1;
      const jsonStr = typeof siteData === 'string' ? siteData : JSON.stringify(siteData);

      if (useTiDB) {
        try {
          // Save current site into TiDB
          await executeTiDB(`
            INSERT INTO aether_sites (id, site_name, data, updated_at) 
            VALUES ('default', ?, ?, NOW(6))
            ON DUPLICATE KEY UPDATE data = VALUES(data), site_name = VALUES(site_name), updated_at = NOW(6)
          `, [siteTitle, jsonStr]);

          // Auto-create a revision snapshot
          const revId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          await executeTiDB(`
            INSERT INTO aether_revisions 
            (id, saved_at, formatted_date, site_name, page_count, total_sections, size_bytes, label, snapshot)
            VALUES (?, NOW(6), ?, ?, ?, ?, ?, 'Publish Snapshot', ?)
          `, [
            revId,
            new Date().toLocaleString(),
            siteTitle,
            pagesCount,
            siteData.sections?.length || 0,
            Buffer.byteLength(jsonStr, 'utf8'),
            jsonStr
          ]);

          // Also mirror to local disk
          writeLocalJson('data/site.json', siteData);
          return sendJson(res, 200, { ok: true, source: 'tidb', revision_id: revId });
        } catch (dbErr: any) {
          console.warn('[TiDB publish fallback to local]', dbErr.message);
          ensureTiDBTables().catch(() => {});
        }
      }

      // Local fallback
      writeLocalJson('data/site.json', siteData);
      return sendJson(res, 200, { ok: true, source: 'local' });
    }

    // ── 5. POST: submit_form ─────────────────────────────────────────────────
    if (action === 'submit_form') {
      const entry = req.body || {};

      // Anti-spam honeypot
      if (entry._hp || entry.website_hp) {
        return sendJson(res, 200, { success: true, message: 'Submission logged.' });
      }

      const subId = 'sub_' + Math.floor(Date.now() / 1000) + '_' + Math.random().toString(36).substring(2, 6);
      const nameVal = entry.name || entry.FullName || entry.fullName || entry.full_name || 'Anonymous';
      const emailVal = entry.email || entry.Email || '';
      const phoneVal = entry.phone || entry.Phone || entry.mobile || '';
      const pageVal = entry.page || 'home';
      const typeVal = entry.type || 'contact';
      const messageVal = entry.message || '';
      const extraJson = JSON.stringify(entry.extra || entry);

      if (useTiDB) {
        await executeTiDB(`
          INSERT INTO aether_submissions 
          (id, submitted_at, is_read, type, name, email, phone, page, message, extra)
          VALUES (?, NOW(6), 0, ?, ?, ?, ?, ?, ?, ?)
        `, [subId, typeVal, nameVal, emailVal, phoneVal, pageVal, messageVal, extraJson]);

        return sendJson(res, 200, {
          success: true,
          id: subId,
          message: 'Submission received successfully in TiDB!',
          source: 'tidb'
        });
      }

      // Fallback: data/submissions.json
      const existing = readLocalJson<any[]>('data/submissions.json', []);
      existing.unshift({
        id: subId,
        submitted_at: new Date().toISOString(),
        is_read: false,
        type: typeVal,
        name: nameVal,
        email: emailVal,
        phone: phoneVal,
        page: pageVal,
        message: messageVal,
        extra: entry
      });
      writeLocalJson('data/submissions.json', existing.slice(0, 1000));

      return sendJson(res, 200, {
        success: true,
        id: subId,
        message: 'Submission received successfully!',
        source: 'local'
      });
    }

    // ── 6. GET: get_submissions ──────────────────────────────────────────────
    if (action === 'get_submissions') {
      if (useTiDB) {
        const rows = await executeTiDB<any>(`
          SELECT id, submitted_at, is_read, type, name, email, phone, page, message, extra 
          FROM aether_submissions 
          ORDER BY submitted_at DESC 
          LIMIT 1000
        `);

        const formatted = rows.map(r => ({
          ...r,
          is_read: Boolean(r.is_read),
          extra: typeof r.extra === 'string' ? JSON.parse(r.extra || '{}') : (r.extra || {})
        }));

        const unreadCount = formatted.filter(s => !s.is_read).length;
        return sendJson(res, 200, {
          success: true,
          submissions: formatted,
          unreadCount,
          totalCount: formatted.length,
          source: 'tidb'
        });
      }

      const subs = readLocalJson<any[]>('data/submissions.json', []);
      const unreadCount = subs.filter(s => !s.is_read).length;
      return sendJson(res, 200, {
        success: true,
        submissions: subs,
        unreadCount,
        totalCount: subs.length,
        source: 'local'
      });
    }

    // ── 7. POST: mark_read ───────────────────────────────────────────────────
    if (action === 'mark_read') {
      const { id } = req.body || {};
      if (useTiDB) {
        if (id) {
          await executeTiDB('UPDATE aether_submissions SET is_read = 1 WHERE id = ?', [id]);
        } else {
          await executeTiDB('UPDATE aether_submissions SET is_read = 1', []);
        }
        return sendJson(res, 200, { success: true, source: 'tidb' });
      }

      const subs = readLocalJson<any[]>('data/submissions.json', []);
      subs.forEach(s => {
        if (!id || s.id === id) s.is_read = true;
      });
      writeLocalJson('data/submissions.json', subs);
      return sendJson(res, 200, { success: true, source: 'local' });
    }

    // ── 8. POST: delete_submission ───────────────────────────────────────────
    if (action === 'delete_submission') {
      const { id } = req.body || {};
      if (useTiDB) {
        if (id) await executeTiDB('DELETE FROM aether_submissions WHERE id = ?', [id]);
        return sendJson(res, 200, { success: true, source: 'tidb' });
      }

      let subs = readLocalJson<any[]>('data/submissions.json', []);
      subs = subs.filter(s => s.id !== id);
      writeLocalJson('data/submissions.json', subs);
      return sendJson(res, 200, { success: true, source: 'local' });
    }

    // ── 9. POST: clear_submissions ───────────────────────────────────────────
    if (action === 'clear_submissions') {
      if (useTiDB) {
        await executeTiDB('DELETE FROM aether_submissions', []);
        return sendJson(res, 200, { success: true, message: 'All submissions cleared from TiDB' });
      }
      writeLocalJson('data/submissions.json', []);
      return sendJson(res, 200, { success: true, message: 'All submissions cleared.' });
    }

    // ── 10. GET: export_submissions_csv ──────────────────────────────────────
    if (action === 'export_submissions_csv') {
      let subs: any[] = [];
      if (useTiDB) {
        subs = await executeTiDB('SELECT * FROM aether_submissions ORDER BY submitted_at DESC');
      } else {
        subs = readLocalJson<any[]>('data/submissions.json', []);
      }

      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      };

      const rows = [
        ['ID', 'Date Submitted', 'Status', 'Source', 'Name', 'Email', 'Phone', 'Page', 'Message']
      ];

      subs.forEach(s => {
        rows.push([
          s.id || '',
          s.submitted_at || '',
          s.is_read ? 'Read' : 'New',
          s.type || 'contact',
          s.name || '',
          s.email || '',
          s.phone || '',
          s.page || '',
          s.message || ''
        ]);
      });

      const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCsv).join(',')).join('\r\n');
      Object.entries(CORS_HEADERS).forEach(([key, val]) => res.setHeader(key, val));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="aether_submissions_${Date.now()}.csv"`);
      return res.status(200).send(csvContent);
    }

    // ── 11. GET: get_addons & POST: save_addons ──────────────────────────────
    if (action === 'get_addons') {
      if (useTiDB) {
        try {
          const rows = await executeTiDB<{ data: any }>(
            'SELECT data FROM aether_addons WHERE id = ? LIMIT 1',
            ['default']
          );
          if (rows && rows.length > 0) {
            const raw = rows[0].data;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return sendJson(res, 200, { success: true, addons: parsed, source: 'tidb' });
          }
        } catch (err: any) {
          if (!err?.message?.includes('1045') && !err?.message?.includes('Access denied')) {
            console.warn('[TiDB get_addons]', err.message);
          }
        }
      }
      const addons = readLocalJson<any[]>('data/addons.json', []);
      return sendJson(res, 200, { success: true, addons, source: 'local' });
    }

    if (action === 'save_addons') {
      const payload = req.body || [];
      const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

      if (useTiDB) {
        try {
          await executeTiDB(`
            INSERT INTO aether_addons (id, data, updated_at) 
            VALUES ('default', ?, NOW(6))
            ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW(6)
          `, [jsonStr]);
          writeLocalJson('data/addons.json', payload);
          return sendJson(res, 200, { success: true, message: 'Add-ons saved in TiDB', source: 'tidb' });
        } catch (dbErr: any) {
          console.warn('[TiDB save_addons fallback to local]', dbErr.message);
          ensureTiDBTables().catch(() => {});
        }
      }

      writeLocalJson('data/addons.json', payload);
      return sendJson(res, 200, { success: true, message: 'Add-ons saved successfully', source: 'local' });
    }

    // ── 12. GET: get_revisions & POST: save_revision / rollback_revision ─────
    if (action === 'get_revisions') {
      if (useTiDB) {
        const rows = await executeTiDB<any>(`
          SELECT id, saved_at, formatted_date as formattedDate, site_name as siteName, 
                 page_count as pageCount, total_sections as totalSections, size_bytes as sizeBytes, label
          FROM aether_revisions 
          ORDER BY saved_at DESC 
          LIMIT 25
        `);
        return sendJson(res, 200, { success: true, revisions: rows, source: 'tidb' });
      }

      const revs = readLocalJson<any[]>('data/revisions.json', []);
      const meta = revs.map(r => ({
        id: r.id || '',
        saved_at: r.saved_at || new Date().toISOString(),
        formattedDate: r.formattedDate || new Date().toLocaleString(),
        siteName: r.siteName || (r.snapshot?.siteSettings?.siteTitle || 'Aether Site'),
        pageCount: r.pageCount || (r.snapshot?.pages?.length || 1),
        totalSections: r.totalSections || 0,
        sizeBytes: r.sizeBytes || 1024,
        label: r.label || 'Auto-save'
      }));
      return sendJson(res, 200, { success: true, revisions: meta, source: 'local' });
    }

    if (action === 'save_revision') {
      const body = req.body || {};
      const revId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const snapshot = body.snapshot || body;
      const jsonStr = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);

      if (useTiDB) {
        await executeTiDB(`
          INSERT INTO aether_revisions 
          (id, saved_at, formatted_date, site_name, page_count, total_sections, size_bytes, label, snapshot)
          VALUES (?, NOW(6), ?, ?, ?, ?, ?, ?, ?)
        `, [
          revId,
          new Date().toLocaleString(),
          body.siteName || 'Aether Site',
          body.pageCount || 1,
          body.totalSections || 0,
          Buffer.byteLength(jsonStr, 'utf8'),
          body.label || 'Manual Save',
          jsonStr
        ]);
        return sendJson(res, 200, { success: true, id: revId, source: 'tidb' });
      }

      const revs = readLocalJson<any[]>('data/revisions.json', []);
      revs.unshift({
        id: revId,
        saved_at: new Date().toISOString(),
        formattedDate: new Date().toLocaleString(),
        label: body.label || 'Manual Save',
        snapshot
      });
      writeLocalJson('data/revisions.json', revs.slice(0, 20));
      return sendJson(res, 200, { success: true, id: revId, source: 'local' });
    }

    if (action === 'rollback_revision') {
      const { revisionId, id } = req.body || {};
      const targetId = revisionId || id;
      if (!targetId) {
        return sendJson(res, 400, { success: false, error: 'No revision ID specified' });
      }

      if (useTiDB) {
        const rows = await executeTiDB<{ snapshot: any }>(
          'SELECT snapshot FROM aether_revisions WHERE id = ? LIMIT 1',
          [targetId]
        );
        if (!rows || rows.length === 0) {
          return sendJson(res, 404, { success: false, error: 'Revision not found in TiDB' });
        }

        const snapshot = rows[0].snapshot;
        const snapStr = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);

        await executeTiDB(`
          INSERT INTO aether_sites (id, data, updated_at) 
          VALUES ('default', ?, NOW(6))
          ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW(6)
        `, [snapStr]);

        return sendJson(res, 200, { success: true, message: 'Restored snapshot from TiDB', source: 'tidb' });
      }

      const revs = readLocalJson<any[]>('data/revisions.json', []);
      const found = revs.find(r => r.id === targetId);
      if (!found) {
        return sendJson(res, 404, { success: false, error: 'Revision not found' });
      }
      writeLocalJson('data/site.json', found.snapshot || found);
      return sendJson(res, 200, { success: true, message: 'Restored successfully', source: 'local' });
    }

    // ── 13. Assets & Cloudinary: list_assets, save_asset, upload, delete_asset ──
    if (action === 'get_cloudinary_config') {
      return sendJson(res, 200, {
        success: true,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'xzglscdg',
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'atether_uploads',
        enabled: true
      });
    }

    if (action === 'save_asset') {
      const asset = req.body || {};
      const name = asset.name || ('asset_' + Date.now());
      const url = asset.url || '';
      const size = Number(asset.size) || 0;
      const ext = (asset.ext || path.extname(name).replace('.', '') || 'jpg').toLowerCase();
      const mimeType = asset.mime_type || asset.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg');
      const assetId = asset.id || ('asset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));

      if (useTiDB && url) {
        try {
          await executeTiDB(`
            INSERT INTO aether_assets (id, name, url, size, ext, mime_type, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(6))
            ON DUPLICATE KEY UPDATE url = VALUES(url), size = VALUES(size), ext = VALUES(ext), mime_type = VALUES(mime_type)
          `, [assetId, name, url, size, ext, mimeType]);
        } catch (err) {
          console.warn('[TiDB save_asset]', err);
        }
      }

      // Also persist to data/assets.json for local/file fallback
      try {
        const assetsFile = path.join(process.cwd(), 'data', 'assets.json');
        let list: any[] = [];
        if (fs.existsSync(assetsFile)) {
          try { list = JSON.parse(fs.readFileSync(assetsFile, 'utf8')); } catch {}
        }
        if (!Array.isArray(list)) list = [];
        list = list.filter(a => a.name !== name && a.url !== url);
        list.unshift({
          id: assetId,
          name,
          url,
          size,
          ext,
          mime_type: mimeType,
          modified: Math.floor(Date.now() / 1000)
        });
        fs.writeFileSync(assetsFile, JSON.stringify(list.slice(0, 500), null, 2), 'utf8');
      } catch (err) {
        console.warn('[save_asset local]', err);
      }

      return sendJson(res, 200, { success: true, asset: { id: assetId, name, url, size, ext } });
    }

    if (action === 'upload') {
      // Server-side upload handler (Cloudinary proxy & local fallback)
      const { file, fileName, uploadPreset, cloudName } = req.body || {};
      const cName = cloudName || process.env.CLOUDINARY_CLOUD_NAME || 'xzglscdg';
      const cPreset = uploadPreset || process.env.CLOUDINARY_UPLOAD_PRESET || 'atether_uploads';

      if (file) {
        try {
          const form = new URLSearchParams();
          form.append('file', file);
          form.append('upload_preset', cPreset);
          form.append('tags', 'aetherbuilder');

          const cRes = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cName)}/auto/upload`, {
            method: 'POST',
            body: form
          });
          const cData: any = await cRes.json();
          if (cRes.ok && cData && (cData.secure_url || cData.url)) {
            const assetName = fileName || (cData.original_filename ? `${cData.original_filename}.${cData.format || 'jpg'}` : `upload_${Date.now()}.${cData.format || 'jpg'}`);
            const secureUrl = cData.secure_url || cData.url;
            const ext = (cData.format || path.extname(assetName).replace('.', '') || 'jpg').toLowerCase();
            const bytes = cData.bytes || 0;

            if (useTiDB) {
              try {
                await executeTiDB(`
                  INSERT INTO aether_assets (id, name, url, size, ext, mime_type, uploaded_at)
                  VALUES (?, ?, ?, ?, ?, ?, NOW(6))
                  ON DUPLICATE KEY UPDATE url = VALUES(url), size = VALUES(size)
                `, ['asset_' + Date.now(), assetName, secureUrl, bytes, ext, 'image/' + ext]);
              } catch (err) {
                console.warn('[TiDB upload asset]', err);
              }
            }

            return sendJson(res, 200, {
              success: true,
              name: assetName,
              url: secureUrl,
              size: bytes,
              ext,
              provider: 'cloudinary'
            });
          } else {
            return sendJson(res, 400, { success: false, error: cData?.error?.message || 'Cloudinary upload rejected' });
          }
        } catch (err: any) {
          return sendJson(res, 500, { success: false, error: err.message || 'Server upload failed' });
        }
      }
      return sendJson(res, 400, { success: false, error: 'No file provided for upload' });
    }

    if (action === 'list_assets') {
      let dbAssets: any[] = [];
      if (useTiDB) {
        try {
          dbAssets = await executeTiDB(`
            SELECT name, url, size, ext, UNIX_TIMESTAMP(uploaded_at) as modified 
            FROM aether_assets 
            ORDER BY uploaded_at DESC
          `);
        } catch (err) {
          console.warn('[TiDB list_assets]', err);
        }
      }

      // Read saved assets from data/assets.json (Cloudinary CDN links)
      let savedAssets: any[] = [];
      const assetsFile = path.join(process.cwd(), 'data', 'assets.json');
      if (fs.existsSync(assetsFile)) {
        try {
          const raw = fs.readFileSync(assetsFile, 'utf8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) savedAssets = parsed;
        } catch {}
      }

      // Read local uploads directory if available
      const uploadsDir = path.join(process.cwd(), 'assets', 'uploads');
      let localFiles: any[] = [];
      if (fs.existsSync(uploadsDir)) {
        try {
          localFiles = fs.readdirSync(uploadsDir).map(f => {
            const stat = fs.statSync(path.join(uploadsDir, f));
            const ext = path.extname(f).slice(1).toLowerCase();
            return {
              name: f,
              url: 'assets/uploads/' + f,
              size: stat.size,
              ext,
              modified: Math.floor(stat.mtimeMs / 1000)
            };
          });
        } catch {}
      }

      // Merge results avoiding duplicate names/urls
      const seen = new Set<string>();
      const combined = [...dbAssets, ...savedAssets, ...localFiles].filter(a => {
        const key = (a.url || a.name || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return sendJson(res, 200, { success: true, assets: combined, source: useTiDB ? 'tidb+local' : 'local' });
    }

    if (action === 'delete_asset') {
      const { name, url } = req.body || {};
      if (useTiDB && name) {
        await executeTiDB('DELETE FROM aether_assets WHERE name = ? OR url = ?', [name, url || '']);
      }
      // Also remove from data/assets.json
      const assetsFile = path.join(process.cwd(), 'data', 'assets.json');
      if (fs.existsSync(assetsFile)) {
        try {
          const list = JSON.parse(fs.readFileSync(assetsFile, 'utf8'));
          if (Array.isArray(list)) {
            const updated = list.filter((a: any) => a.name !== name && a.url !== url && a.url !== name);
            fs.writeFileSync(assetsFile, JSON.stringify(updated, null, 2), 'utf8');
          }
        } catch {}
      }
      const safeName = path.basename(name || '');
      const localTarget = path.join(process.cwd(), 'assets', 'uploads', safeName);
      if (fs.existsSync(localTarget)) {
        try { fs.unlinkSync(localTarget); } catch {}
      }
      return sendJson(res, 200, { success: true, message: 'Asset deleted' });
    }

    // ── 14. GET: get_system_info ─────────────────────────────────────────────
    if (action === 'get_system_info') {
      return sendJson(res, 200, {
        success: true,
        version: '2.9.13-vercel-tidb',
        runtime: 'Vercel Serverless Function (Node.js)',
        database: useTiDB ? 'TiDB Cloud Serverless (MySQL 8.0)' : 'Local JSON Fallback',
        tidb_connected: useTiDB,
        server_time: new Date().toISOString()
      });
    }

    return sendJson(res, 400, { error: `Unrecognized or missing action: "${action}"` });
  } catch (err: any) {
    console.error(`[API Handler Error] action=${action}:`, err);
    return sendJson(res, 500, { success: false, error: err.message || 'Internal Server Error' });
  }
}
