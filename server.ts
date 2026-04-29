import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from 'stripe';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization for Stripe
let stripeClient: Stripe | null = null;

// Lazy initialization for Aiven (PostgreSQL)
let pool: any = null;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('DATABASE_URL is not defined. Aiven connectivity disabled.');
      return null;
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false // Required for Aiven usually
      }
    });
  }
  return pool;
}

async function initDb() {
  const pool = getPool();
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        image_url TEXT,
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        photo_url TEXT,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2025-01-27' as any,
    });
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  
  // Initialize DB before starting
  await initDb();

  // API routes
  app.get("/api/health", async (req, res) => {
    let dbStatus = "not connected";
    const pool = getPool();
    if (pool) {
      try {
        await pool.query('SELECT 1');
        dbStatus = "connected";
      } catch (err) {
        dbStatus = "error";
      }
    }
    res.json({ 
      status: "ok", 
      service: "grilled-chicken-ordering",
      database: dbStatus
    });
  });

  // Products API
  app.get("/api/products", async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });
    try {
      const result = await pool.query('SELECT * FROM products ORDER BY category, name');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Users Sync API
  app.post("/api/users/sync", async (req, res) => {
    const { id, email, displayName, photoURL } = req.body;
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });
    try {
      await pool.query(`
        INSERT INTO users (id, email, display_name, photo_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          photo_url = EXCLUDED.photo_url
      `, [id, email, displayName, photoURL]);
      res.json({ status: 'synced' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to sync user' });
    }
  });

  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount } = req.body;
      const stripe = getStripe();
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
