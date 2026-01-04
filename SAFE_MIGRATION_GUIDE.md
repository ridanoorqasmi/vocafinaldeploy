# Safe Database Migration Guide

## ⚠️ Important: Never Use `prisma db push` on Production Data

`prisma db push` can be **destructive** and may drop tables or data. Use it **only** in development with empty databases.

## ✅ Safe Migration Commands

### 1. Apply Pending Migrations (Non-Destructive)
```powershell
npx prisma migrate deploy
```
- ✅ **Safe**: Only applies pending migrations
- ✅ **Non-destructive**: Never drops tables
- ✅ **Production-safe**: Use in production
- ✅ **Preserves data**: All existing data is safe

### 2. Create and Apply New Migrations (Development)
```powershell
npx prisma migrate dev --name your_migration_name
```
- ✅ **Safe**: Creates migration file first (you can review it)
- ✅ **Non-destructive**: Only adds/modifies schema
- ✅ **Reviewable**: Check the migration SQL before applying
- ⚠️ **Development**: Use in development/staging

### 3. Check Migration Status
```powershell
npx prisma migrate status
```
- Shows which migrations are pending
- Shows which migrations have been applied
- Helps you understand your database state

## ❌ Commands to Avoid with Existing Data

### `prisma db push` - DANGEROUS
```powershell
# ❌ DON'T USE THIS if you have existing data!
npx prisma db push
```
- ⚠️ **Can drop tables** if schema changes significantly
- ⚠️ **No migration files** - changes are not tracked
- ⚠️ **No rollback** - can't undo changes
- ⚠️ **Data loss risk** - may delete existing data

**Only use `db push` when:**
- Database is empty (development)
- You don't care about data loss
- You're prototyping

## 🔍 What Just Happened

You had a pending migration: `20250122000000_add_question_analytics`

This migration:
- ✅ Created a new `question_analytics` table
- ✅ Added indexes for performance
- ✅ **Did NOT drop any existing tables**
- ✅ **Did NOT modify existing data**

## 📋 Migration Workflow

### For New Schema Changes:

1. **Modify your schema** (`prisma/schema.prisma`)
2. **Create migration file:**
   ```powershell
   npx prisma migrate dev --name describe_your_change
   ```
3. **Review the migration file** in `prisma/migrations/`
4. **Apply it:**
   ```powershell
   npx prisma migrate deploy
   ```
5. **Generate Prisma client:**
   ```powershell
   npx prisma generate
   ```

### For Applying Existing Migrations:

```powershell
# Check what's pending
npx prisma migrate status

# Apply all pending migrations safely
npx prisma migrate deploy
```

## 🛡️ Best Practices

1. **Always backup** before migrations in production
2. **Test migrations** in development/staging first
3. **Review migration SQL** before applying
4. **Use `migrate deploy`** in production
5. **Never use `db push`** with existing data
6. **Check migration status** regularly

## 🔧 Troubleshooting

### "Migration conflicts"
- Check `prisma/migrations/` folder
- Review migration history
- Use `prisma migrate resolve` if needed

### "Schema drift detected"
- Your database schema doesn't match Prisma schema
- Use `prisma migrate dev` to create a migration
- Review the generated migration carefully

### "Table already exists"
- Migration was partially applied
- Check migration status: `npx prisma migrate status`
- Mark migration as applied: `prisma migrate resolve --applied <migration_name>`

## 📚 Additional Resources

- [Prisma Migrate Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Migration Best Practices](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)





