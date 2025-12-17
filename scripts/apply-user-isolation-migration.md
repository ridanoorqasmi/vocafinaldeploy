# Manual Migration Instructions

## Problem
The Prisma query engine DLL file is locked by the running dev server, preventing `npx prisma generate` from completing.

## Solution

### Step 1: Stop the Dev Server
**Important:** Stop your Next.js dev server first (press `Ctrl+C` in the terminal where `npm run dev` is running)

### Step 2: Apply Database Migration
You have two options:

#### Option A: Apply Migration SQL Manually (Recommended)
1. Open your PostgreSQL database client (pgAdmin, DBeaver, or psql)
2. Connect to your database: `voca_order_taking`
3. Run the SQL from: `prisma/migrations/20251103230943_add_user_isolation_to_followup_agent/migration.sql`

#### Option B: Use Prisma Migrate (Alternative)
```powershell
npx prisma migrate deploy
```

### Step 3: Generate Prisma Client
```powershell
npx prisma generate
```

### Step 4: Restart Dev Server
```powershell
npm run dev
```

## Why This Happens
Windows locks DLL files when they're in use. The Next.js dev server uses the Prisma client, which locks the query engine DLL file, preventing Prisma from replacing it during generation.

## Quick Fix Script
You can also run:
```powershell
.\scripts\fix-prisma-generate.ps1
```

