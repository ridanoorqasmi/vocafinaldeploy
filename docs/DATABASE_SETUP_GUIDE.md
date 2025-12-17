# 🗄️ Database Setup Guide

## 📋 Issue Identified

The authentication system is failing because of database connection issues. The error shows:

```
Authentication failed against database server at `localhost`, the provided database credentials for `postgres` are not valid.
```

## 🔧 Solutions

### Option 1: Use SQLite (Recommended for Testing)

SQLite is easier to set up and doesn't require a separate database server.

**Update your `.env.local` file:**
```env
DATABASE_URL="file:./dev.db"
```

**Then run:**
```bash
npm run db:push
npm run db:seed
```

### Option 2: Fix PostgreSQL Connection

If you want to use PostgreSQL, you need to:

1. **Install PostgreSQL** (if not already installed)
2. **Create a database** named `voca_order_taking`
3. **Set correct credentials**

**Common PostgreSQL connection strings:**
```env
# Default PostgreSQL setup
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voca_order_taking"

# If you have a different password
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/voca_order_taking"

# If using a different user
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/voca_order_taking"
```

### Option 3: Use Docker PostgreSQL

**Create a `docker-compose.yml` file:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: voca_order_taking
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Run with Docker:**
```bash
docker-compose up -d
```

## 🚀 Quick Fix (SQLite)

Let's use SQLite for now to get the system working:
