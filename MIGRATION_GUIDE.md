# Database Migration Guide for Poppy

## Quick Start

### 1. Ensure Database is Running

Make sure your PostgreSQL database is running and `DATABASE_URL` is set in `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/vocaai?schema=public"
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Push Schema to Database

**For Development:**
```bash
npx prisma db push
```

**For Production (creates migration file):**
```bash
npx prisma migrate dev --name add_poppy_models
```

### 4. Verify Tables Created

```bash
npx prisma studio
```

Open Prisma Studio and verify these tables exist:
- `poppy_tenants`
- `poppy_users`
- `poppy_auth_sessions`
- `poppy_datasets`
- `poppy_dataset_versions`
- `poppy_dataset_profiles`
- `poppy_analysis_sessions`
- `poppy_chat_messages`
- `poppy_artifacts`
- `poppy_explanations`
- `poppy_token_usage`
- `poppy_audit_logs`

## Migration Steps

### Step 1: Update Store Files

Replace in-memory stores with database-backed versions:

1. **Auth Store:**
   - Copy `lib/auth/store-db.ts` → `lib/auth/store.ts`
   - Update all functions to be `async`
   - Update imports in API routes

2. **Dataset Store:**
   - Copy `lib/poppy/services/dataset-store-db.ts` → `lib/poppy/services/dataset-store.ts`
   - Update all functions to be `async`
   - Update imports in API routes

3. **Session Store:**
   - Create `lib/poppy/services/session-store-db.ts` (similar pattern)
   - Replace in-memory Maps with Prisma queries

4. **Artifact Store:**
   - Create `lib/poppy/services/artifact-store-db.ts` (similar pattern)
   - Replace in-memory Maps with Prisma queries

5. **Explanation Store:**
   - Create `lib/poppy/services/explanation/explanation-store-db.ts` (similar pattern)
   - Replace in-memory Maps with Prisma queries

### Step 2: Update API Routes

All API routes need to handle async store operations:

**Before:**
```typescript
const dataset = datasetStoreModule.getDataset(datasetId);
```

**After:**
```typescript
const dataset = await datasetStoreModule.getDataset(datasetId);
```

### Step 3: Update Middleware

Update `lib/auth/middleware.ts` to use async store functions:

**Before:**
```typescript
const session = getSession(sessionToken);
```

**After:**
```typescript
const session = await getSession(sessionToken);
```

## Testing After Migration

1. **Test Authentication:**
   - Login with demo credentials
   - Verify session persists in database
   - Restart server, verify session still works

2. **Test Dataset Operations:**
   - Create dataset
   - Upload file
   - Restart server, verify dataset still exists

3. **Test Session Operations:**
   - Create session
   - Send messages
   - Verify artifacts persist

## Troubleshooting

### "Table does not exist"
Run: `npx prisma db push`

### "Connection refused"
Check `DATABASE_URL` in `.env`

### "Column does not exist"
Run: `npx prisma generate`

### Data not persisting
- Check database connection
- Verify Prisma client is using correct database
- Check for transaction errors in logs

## Important Notes

⚠️ **Data Loss Warning:** Migrating from in-memory to database will lose all existing in-memory data. This is expected and necessary for persistence.

✅ **After Migration:** All data will persist across server restarts and serverless function instances.







