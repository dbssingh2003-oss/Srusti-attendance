# 🚀 Vercel Deployment Guide - Srusti Attendance System

This project is fully configured for seamless one-click deployment on **Vercel** with fullstack support (Vite React SPA Frontend + Express/Prisma Serverless API connected to Neon PostgreSQL).

---

## 📋 What Has Been Configured

1. **`vercel.json` (Root)**:
   - Configures the build command (`npm run vercel-build`).
   - Serves the frontend SPA from `client/dist`.
   - Routes `/api/(.*)` to the serverless function `api/index.ts`.
   - Handles client-side SPA routing (`index.html` fallback).
   - Optimizes asset caching with 1-year immutable cache headers for `/assets/*`.

2. **`api/index.ts` (Vercel Serverless Function)**:
   - Bridges the Express application (`server/src/app.ts`) to Vercel Serverless Functions.
   - Dual-mounts API routes (`/api/v1` and `/v1`) so endpoints never 404 regardless of URL rewrites.
   - Safe body parsing and resilient CORS handling for all `.vercel.app` domains.

3. **`server/prisma/schema.prisma`**:
   - Added `binaryTargets = ["native", "rhel-openssl-3.0.x", "debian-openssl-3.0.x"]` so Prisma query engines are bundled for Vercel's Amazon Linux/RHEL serverless environment.

4. **`server/src/lib/prisma.ts`**:
   - Implemented serverless global connection singleton to prevent connection pool exhaustion on Neon DB.

5. **`package.json` (Root)**:
   - Configured npm workspaces (`client` and `server`).
   - Automated `vercel-build` script (`npm run db:generate --workspace=server && npm run build --workspace=client`).

---

## 🛠️ Option 1: Deploy via GitHub (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure Vercel fullstack deployment"
   git push origin main
   ```

2. **Import Project into Vercel**:
   - Go to [vercel.com](https://vercel.com) and click **"Add New..."** ➔ **"Project"**.
   - Select your GitHub repository.
   - **Framework Preset**: Leave as `Other` or `Vite`.
   - **Root Directory**: Leave as `./` (project root).
   - **Build and Output Settings**: Defaults are automatically picked up from `vercel.json`.

3. **Configure Environment Variables in Vercel**:
   In the **Environment Variables** section on Vercel, add:

   | Variable Name | Value | Description |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://neondb_owner:npg_MEAl3OgnFm1R@ep-raspy-shape-b3a0rsqn-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Your Neon PostgreSQL connection string |
   | `JWT_ACCESS_SECRET` | `srusti-attendance-production-jwt-access-secret-32chars` | Strong secret for signing JWT tokens |
   | `NODE_ENV` | `production` | Production mode |
   | `APP_TIMEZONE` | `Asia/Kolkata` | Application timezone |
   | `CLIENT_ORIGIN` | `https://your-project-name.vercel.app` | Your Vercel domain (optional, CORS allows all `.vercel.app` by default) |

4. Click **"Deploy"**! 🎉

---

## ⚡ Option 2: Deploy via Vercel CLI

You can also deploy directly from your local terminal:

1. **Login to Vercel**:
   ```bash
   npx vercel login
   ```

2. **Deploy to Preview**:
   ```bash
   npx vercel
   ```

3. **Deploy to Production**:
   ```bash
   npx vercel --prod
   ```

When prompted:
- Set up and deploy: **`Y`**
- Which scope: *(choose your account)*
- Link to existing project: **`N`**
- What's your project's name: `srusti-attendance` (or any name you choose)
- In which directory is your code located: **`./`**

After linking, add your environment variables using:
```bash
npx vercel env add DATABASE_URL
npx vercel env add JWT_ACCESS_SECRET
```

---

## 🔍 Verification After Deployment

Once deployed, you can verify your live deployment:

1. **Health Check**:
   Open `https://<your-project>.vercel.app/api/health`
   Expected response:
   ```json
   { "status": "ok", "timestamp": "2026-09-30T..." }
   ```

2. **Frontend Portal**:
   Open `https://<your-project>.vercel.app`
   - Test Login as Student, Teacher, or Admin.
   - Verify Teacher subject management and subject creation.
   - Verify Admin user directory and attendance audits.
