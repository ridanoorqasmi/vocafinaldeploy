# Quick Migration Steps

## Step 1: Add Models to Database

```bash
# Generate Prisma client with new models
npx prisma generate

# Push schema to database (development)
npx prisma db push

# OR create migration (production)
npx prisma migrate dev --name add_poppy_models
```

## Step 2: Replace Store Files

**Option A: Quick Replace (Development)**
1. Backup existing store files
2. Rename `-db.ts` files to replace originals:
   - `lib/auth/store-db.ts` → `lib/auth/store.ts`
   - `lib/poppy/services/dataset-store-db.ts` → `lib/poppy/services/dataset-store.ts`
   - `lib/poppy/services/session-store-db.ts` → `lib/poppy/services/session-store.ts`
   - `lib/poppy/services/artifact-store-db.ts` → `lib/poppy/services/artifact-store.ts`
   - `lib/poppy/services/explanation/explanation-store-db.ts` → `lib/poppy/services/explanation/explanation-store.ts`

**Option B: Gradual Migration (Recommended)**
1. Keep both versions
2. Update imports one by one
3. Test each store migration separately

## Step 3: Update API Routes to Use Async

All API routes need to await store functions:

**Files to Update:**
- `app/api/poppy/datasets/route.ts`
- `app/api/poppy/datasets/[id]/upload/route.ts`
- `app/api/poppy/datasets/[id]/profile/route.ts`
- `app/api/poppy/analysis-sessions/route.ts`
- `app/api/poppy/analysis-sessions/[id]/messages/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `lib/auth/middleware.ts`

**Example Change:**
```typescript
// Before
const dataset = datasetStoreModule.getDataset(datasetId);

// After
const dataset = await datasetStoreModule.getDataset(datasetId);
```

## Step 4: Test

1. Restart server
2. Login with demo credentials
3. Create dataset
4. Upload file
5. Verify data persists after restart

## Troubleshooting

**"Cannot find module '@/lib/prisma'"**
- Run: `npx prisma generate`

**"Table does not exist"**
- Run: `npx prisma db push`

**"Connection refused"**
- Check `DATABASE_URL` in `.env`







