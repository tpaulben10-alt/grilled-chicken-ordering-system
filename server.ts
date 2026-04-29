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

    // Set this for production/hosted envs where self-signed certs are common
    if (connectionString.includes('aivencloud.com') || connectionString.includes('render.com')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

async function initDb() {
  const pool = getPool();
  if (!pool) return;

  let client;
  try {
    client = await pool.connect();
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
        phone VARCHAR(50),
        address TEXT,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure columns exist if table was already created
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) REFERENCES users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        delivery_address TEXT NOT NULL,
        phone VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        transaction_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID,
        name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL
      );
    `);
    console.log('Database initialized successfully.');
    const countRes = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(countRes.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO products (name, price, category, description, image_url)
        VALUES 
        ('Signature Smoked Quarter', 12.50, 'Mains', 'Slow-smoked for 6 hours over hickory charcoal, finished with a honey-soy glaze.', 'https://images.unsplash.com/photo-1596662951482-0c4ba74a6df6?q=80&w=800'),
        ('Jerk Spice Whole Chicken', 24.00, 'Mains', 'Full chicken marinated in authentic Caribbean jerk spices, grilled to perfection.', 'https://images.unsplash.com/photo-1606728035253-49e8a23146de?q=80&w=800'),
        ('Crispy Truffle Fries', 6.50, 'Sides', 'Double-fried hand-cut potatoes tossed in parmesan and premium white truffle oil.', 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?q=80&w=800'),
        ('Fresh Honey Slaw', 4.50, 'Sides', 'Zesty purple cabbage and heritage carrots in a light citrus honey cream.', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=800'),
        ('Craft Hibiscus Tea', 3.50, 'Drinks', 'Cold-steeped organic hibiscus flowers with a hint of wild mint.', 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?q=80&w=800')
      `);
      console.log('Database seeded with initial products.');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    if (client) client.release();
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

  // User Profile API
  app.get("/api/users/:userId", async (req, res) => {
    const { userId } = req.params;
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });
    try {
      const result = await pool.query('SELECT id, email, display_name, photo_url, phone, address, is_admin FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  app.patch("/api/users/:userId", async (req, res) => {
    const { userId } = req.params;
    const { displayName, phone, address } = req.body;
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });
    try {
      await pool.query(`
        UPDATE users 
        SET display_name = $1, phone = $2, address = $3
        WHERE id = $4
      `, [displayName, phone, address, userId]);
      res.json({ status: 'updated' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Orders API
  app.post("/api/orders", async (req, res) => {
    const { userId, totalAmount, deliveryAddress, phone, items, transactionId } = req.body;
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const orderRes = await client.query(`
        INSERT INTO orders (user_id, total_amount, delivery_address, phone, transaction_id, payment_status)
        VALUES ($1, $2, $3, $4, $5, 'paid')
        RETURNING id
      `, [userId, totalAmount, deliveryAddress, phone, transactionId]);
      
      const orderId = orderRes.rows[0].id;

      for (const item of items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, name, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
        `, [orderId, item.productId || null, item.name, item.quantity, item.price]);
      }

      await client.query('COMMIT');
      res.json({ id: orderId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Failed to place order' });
    } finally {
      client.release();
    }
  });

  app.get("/api/orders/my/:userId", async (req, res) => {
    const { userId } = req.params;
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });
    try {
      const result = await pool.query(`
        SELECT o.*, 
        (SELECT json_agg(oi) FROM order_items oi WHERE oi.order_id = o.id) as items
        FROM orders o
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
      `, [userId]);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch orders' });
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
