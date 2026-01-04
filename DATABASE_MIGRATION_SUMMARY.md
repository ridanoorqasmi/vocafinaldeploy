# Database Migration Summary for Poppy

## Problem

Currently, Poppy uses **in-memory stores** (JavaScript Maps) which means:
- ❌ Data is lost on server restart
- ❌ Data doesn't persist across serverless function instances
- ❌ Datasets, sessions, artifacts, and auth credentials are not saved
- ❌ No data persistence between deployments

## Solution

Migrate to **PostgreSQL database** using Prisma ORM for:
- ✅ Persistent data storage
- ✅ Data survives server restarts
- ✅ Works across serverless instances
- ✅ Proper relationships and constraints
- ✅ Queryable audit logs and token usage

## What I've Created

### 1. Prisma Schema Models (`prisma/schema.prisma`)

Added 12 new models:
- `PoppyTenant` - Organizations/tenants
- `PoppyUser` - User accounts with roles
- `PoppyAuthSession` - Authentication sessions
- `PoppyDataset` - Datasets
- `PoppyDatasetVersion` - File versions
- `PoppyDatasetProfile` - Profiling data
- `PoppyAnalysisSession` - Analysis sessions
- `PoppyChatMessage` - Chat messages
- `PoppyArtifact` - Generated artifacts
- `PoppyExplanation` - LLM explanations
- `PoppyTokenUsage` - Token tracking
- `PoppyAuditLog` - Audit logs

### 2. Database-Backed Store Files

Created database versions of all stores:
- `lib/auth/store-db.ts` - Auth store with Prisma
- `lib/poppy/services/dataset-store-db.ts` - Dataset store with Prisma
- `lib/poppy/services/session-store-db.ts` - Session store with Prisma
- `lib/poppy/services/artifact-store-db.ts` - Artifact store with Prisma
- `lib/poppy/services/explanation/explanation-store-db.ts` - Explanation store with Prisma

### 3. Documentation

- `docs/PHASE_6_DATABASE_MIGRATION.md` - Detailed migration guide
- `MIGRATION_GUIDE.md` - Step-by-step instructions
- `QUICK_MIGRATION_STEPS.md` - Quick reference

## What You Need to Do

### Step 1: Run Database Migration

```bash
# 1. Generate Prisma client
npx prisma generate

# 2. Push schema to database (development)
npx prisma db push

# OR create migration (production)
npx prisma migrate dev --name add_poppy_models
```

### Step 2: Replace Store Files

**Option A: Quick Replace (All at once)**
```bash
# Backup originals first!
mv lib/auth/store.ts lib/auth/store-inmemory.ts.backup
mv lib/poppy/services/dataset-store.ts lib/poppy/services/dataset-store-inmemory.ts.backup
mv lib/poppy/services/session-store.ts lib/poppy/services/session-store-inmemory.ts.backup
mv lib/poppy/services/artifact-store.ts lib/poppy/services/artifact-store-inmemory.ts.backup
mv lib/poppy/services/explanation/explanation-store.ts lib/poppy/services/explanation/explanation-store-inmemory.ts.backup

# Replace with database versions
cp lib/auth/store-db.ts lib/auth/store.ts
cp lib/poppy/services/dataset-store-db.ts lib/poppy/services/dataset-store.ts
cp lib/poppy/services/session-store-db.ts lib/poppy/services/session-store.ts
cp lib/poppy/services/artifact-store-db.ts lib/poppy/services/artifact-store.ts
cp lib/poppy/services/explanation/explanation-store-db.ts lib/poppy/services/explanation/explanation-store.ts
```

**Option B: Gradual Migration (Recommended)**
1. Update one store at a time
2. Test after each migration
3. Keep backups of original files

### Step 3: Update API Routes for Async

All store functions are now `async`, so update API routes:

**Files to Update:**
- `app/api/poppy/datasets/route.ts` ✅ (already updated)
- `app/api/poppy/datasets/[id]/upload/route.ts` ✅ (already updated)
- `app/api/poppy/datasets/[id]/profile/route.ts` ✅ (already updated)
- `app/api/poppy/analysis-sessions/route.ts` ✅ (already updated)
- `app/api/poppy/analysis-sessions/[id]/messages/route.ts` (needs update)
- `app/api/poppy/analysis-sessions/[id]/route.ts` (needs update)
- `app/api/auth/login/route.ts` (needs update)
- `app/api/auth/logout/route.ts` (needs update)
- `app/api/auth/me/route.ts` (needs update)
- `lib/auth/middleware.ts` (needs update)

**Example Change:**
```typescript
// Before
const dataset = storeModule.getDataset(datasetId);

// After
const dataset = await storeModule.getDataset(datasetId);
```

### Step 4: Update Middleware

Update `lib/auth/middleware.ts` to use async store functions:

```typescript
// Before
const session = getSession(sessionToken);

// After
const session = await getSession(sessionToken);
```

## Testing Checklist

After migration:

- [ ] Login works and persists
- [ ] Create dataset works
- [ ] Upload file works
- [ ] Dataset profile loads
- [ ] Create session works
- [ ] Send message works
- [ ] Artifacts are created
- [ ] Data persists after server restart
- [ ] Data persists across serverless instances

## Current Status

✅ **Schema Models:** Added to `prisma/schema.prisma`
✅ **Database Store Files:** Created (with `-db.ts` suffix)
✅ **API Routes:** Partially updated (datasets, upload, profile, sessions)
⏳ **Remaining:** Update remaining API routes and middleware for async

## Next Steps

1. Run `npx prisma generate && npx prisma db push`
2. Replace store files (or update imports)
3. Update remaining API routes for async
4. Update middleware for async
5. Test thoroughly
6. Deploy!

## Need Help?

If you encounter issues:
1. Check `DATABASE_URL` in `.env`
2. Verify database is running
3. Check Prisma client is generated
4. Review error messages in console
5. Use `npx prisma studio` to inspect database







