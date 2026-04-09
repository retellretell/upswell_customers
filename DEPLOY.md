# Upswell Customer Collection — Deployment Guide

## 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** → **New Query**
3. Paste the contents of `supabase-schema.sql` and click **Run**
4. Go to **Settings** → **API** and copy:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

## 2. Local Development

```bash
# Install dependencies
npm install

# Create .env.local with your Supabase credentials
cp .env.example .env.local
# Edit .env.local with your actual values

# Start dev server
npm run dev
```

## 3. Deploy to Vercel

### Option A: Vercel CLI
```bash
npm i -g vercel
vercel
# Follow prompts, then add env vars:
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

### Option B: Vercel Dashboard
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → **Import Project** → select your repo
3. Framework: **Vite**
4. Add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**

## 4. Generate QR Code

After deployment, take your Vercel URL (e.g., `https://upswell-customers.vercel.app`)
and generate a QR code at [qr-code-generator.com](https://www.qr-code-generator.com/)
or any QR service.

## File Structure

```
upswell-customers/
├── index.html              # Entry HTML
├── package.json            # Dependencies
├── vite.config.js          # Vite config
├── supabase-schema.sql     # Run this in Supabase SQL Editor
├── .env.example            # Template for env vars
├── DEPLOY.md               # This file
└── src/
    ├── main.jsx            # React entry point
    ├── supabaseClient.js   # Supabase client singleton
    └── App.jsx             # Full application
```
