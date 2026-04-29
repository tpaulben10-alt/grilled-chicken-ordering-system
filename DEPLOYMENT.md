# Deployment Guide: Render & Aiven

This guide explains how to connect your application to **Aiven** (Postgres Database) and deploy it to **Render** as a Web Service.

## 1. Set up Aiven (PostgreSQL)

1.  **Register/Login**: Go to [Aiven.io](https://aiven.io/) and create an account.
2.  **Create Service**:
    *   Click **"Create service"**.
    *   Select **PostgreSQL**.
    *   Choose your preferred cloud provider (e.g., Google Cloud or AWS) and region.
    *   Select a plan (the "Free" tier is perfect for testing).
    *   Name your service (e.g., `grilled-chicken-db`) and click **"Create service"**.
3.  **Get Connection String**:
    *   Once the service is "Running", look for the **"Service URI"** in the overview tab.
    *   It looks like: `postgres://user:password@hostname:port/defaultdb?sslmode=require`.
    *   Copy this URI. You will use it as `DATABASE_URL` in the next steps.

## 2. Prepare for Render

1.  **GitHub Connection**: Ensure your code is pushed to a GitHub repository.
2.  **Render Dashboard**: Go to [Render.com](https://render.com/) and log in.
3.  **Create Web Service**:
    *   Click **"New +"** and select **"Web Service"**.
    *   Connect your GitHub repository.
4.  **Configuration**:
    *   **Name**: `grilled-chicken-ordering` (or your choice).
    *   **Environment**: `Node`.
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `npm start`
5.  **Environment Variables**:
    *   Click **"Advanced"** -> **"Add Environment Variable"**.
    *   Add `DATABASE_URL`: (Paste your Aiven Service URI).
    *   Add `STRIPE_SECRET_KEY`: (Your Stripe Secret Key).
    *   Add `VITE_STRIPE_PUBLISHABLE_KEY`: (Your Stripe Publishable Key).
    *   Add `NODE_ENV`: `production`.
    *   Add `GEMINI_API_KEY`: (Your Gemini API Key if using AI features).

## 3. Verify Deployment

1.  Once the deployment is finished, Render will provide a URL (e.g., `https://your-app.onrender.com`).
2.  Navigate to `https://your-app.onrender.com/api/health`.
3.  You should see:
    ```json
    {
      "status": "ok",
      "service": "grilled-chicken-ordering",
      "database": "connected"
    }
    ```
    If `database` says `connected`, your Aiven Postgres setup is working!

## 4. SQL Schema Reference

The application automatically creates these tables, but if you want to verify them in the Aiven SQL Console, here is the structure:

```sql
-- Menu Products
CREATE TABLE products (
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

-- Registered Users
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    photo_url TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 5. Why server.ts instead of server.js?

We use `server.ts` because this project is built with **TypeScript**.
*   **Benefits**: Static typing, better IDE support, and fewer runtime errors.
*   **Execution**:
    *   In **Development**: We use `tsx` (TypeScript Execute) to run the file directly.
    *   In **Production**: Modern Node.js versions (v22+) or tools like `tsx` allow running `.ts` files directly via type-stripping, making the workflow seamless without a separate "transpilation" step for the backend.
