import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface SyncRecord {
  data: any;
  updatedAt: string;
  version: number;
  lastDeviceId?: string;
  userEmail?: string;
}

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create data directory, using in-memory store:', err);
  }
}

const DATA_FILE = path.join(DATA_DIR, 'sync_store.json');

// In-memory cache backed by file
const syncStore: Record<string, SyncRecord> = {};

// Load existing data from file if present
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    Object.assign(syncStore, parsed);
    console.log(`Loaded ${Object.keys(syncStore).length} sync keys from store`);
  } catch (e) {
    console.error('Error loading sync_store.json:', e);
  }
}

function persistStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(syncStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write sync_store.json:', err);
  }
}

// Active Server-Sent Events (SSE) connections
const sseClients = new Map<string, Set<express.Response>>();

function broadcastToKey(key: string, payload: any, senderDeviceId?: string) {
  const clients = sseClients.get(key);
  if (!clients || clients.size === 0) return;

  const message = `event: sync-update\ndata: ${JSON.stringify({ ...payload, senderDeviceId })}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));

  // API Routes for Cloud Sync
  app.get('/api/sync', (req, res) => {
    const key = ((req.query.key as string) || 'default_user').trim().toLowerCase();
    const record = syncStore[key];
    if (!record) {
      return res.json({ success: true, exists: false, data: null });
    }
    return res.json({
      success: true,
      exists: true,
      data: record.data,
      updatedAt: record.updatedAt,
      version: record.version,
      userEmail: record.userEmail,
    });
  });

  app.post('/api/sync', (req, res) => {
    const { key, data, deviceId, userEmail } = req.body;
    const syncKey = ((key as string) || 'default_user').trim().toLowerCase();

    if (!data) {
      return res.status(400).json({ success: false, error: 'Data is required' });
    }

    const current = syncStore[syncKey] || {
      data: null,
      updatedAt: new Date().toISOString(),
      version: 0,
    };

    const newVersion = (current.version || 0) + 1;
    const updatedAt = new Date().toISOString();

    syncStore[syncKey] = {
      data,
      updatedAt,
      version: newVersion,
      lastDeviceId: deviceId,
      userEmail: userEmail || current.userEmail,
    };

    persistStore();

    // Broadcast instant update to all SSE subscribers of this sync key (e.g. PC or phone)
    broadcastToKey(
      syncKey,
      {
        data,
        updatedAt,
        version: newVersion,
        userEmail: userEmail || current.userEmail,
      },
      deviceId
    );

    return res.json({
      success: true,
      version: newVersion,
      updatedAt,
    });
  });

  // Server-Sent Events stream for instant real-time sync between smartphone & PC
  app.get('/api/sync/events', (req, res) => {
    const key = ((req.query.key as string) || 'default_user').trim().toLowerCase();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (!sseClients.has(key)) {
      sseClients.set(key, new Set());
    }
    const clientSet = sseClients.get(key)!;
    clientSet.add(res);

    // Initial connection acknowledgment
    res.write(
      `event: connected\ndata: ${JSON.stringify({ connected: true, key, activeDevices: clientSet.size })}\n\n`
    );

    // Keep-alive heartbeat every 15 seconds
    const interval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(interval);
        clientSet.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(interval);
      clientSet.delete(res);
    });
  });

  // Health and pairing status
  app.get('/api/sync/status', (req, res) => {
    const key = ((req.query.key as string) || 'default_user').trim().toLowerCase();
    const clients = sseClients.get(key);
    const record = syncStore[key];
    res.json({
      online: true,
      key,
      activeDevicesCount: clients ? clients.size : 0,
      hasData: Boolean(record),
      lastUpdated: record?.updatedAt || null,
      serverTime: new Date().toISOString(),
    });
  });

  // Serve Vite in dev mode or static build in production
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'));

  if (isProd) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PhysioTracker server ready on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
