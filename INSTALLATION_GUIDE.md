# 📦 VOCA AI - Complete Installation Guide

## ✅ Prerequisites Checklist

Before you start, you need to install the following:

### 1. **Node.js** (REQUIRED)
- **Version**: Node.js 18 or higher
- **Download**: https://nodejs.org/
- **Verify Installation**:
  ```bash
  node --version
  npm --version
  ```
  Should show v18.x.x or higher

### 2. **PostgreSQL Database** (REQUIRED)
- **Option A**: Install PostgreSQL locally
  - **Windows**: Download from https://www.postgresql.org/download/windows/
  - **Mac**: `brew install postgresql@15` or download from postgresql.org
  - **Linux**: `sudo apt-get install postgresql postgresql-contrib`
  
- **Option B**: Use Docker (Easier)
  ```bash
  docker run --name voca-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=voca_order_taking -p 5432:5432 -d postgres:15
  ```

- **Verify Installation**:
  ```bash
  psql --version
  ```

### 3. **Git** (Optional but Recommended)
- **Download**: https://git-scm.com/
- Used for version control

---

## 🚀 Step-by-Step Installation

### Step 1: Install Node.js Dependencies

Open your terminal/command prompt in the project directory and run:

```bash
npm install
```

This will install all required packages from `package.json` (50+ dependencies).

**Expected time**: 2-5 minutes depending on your internet speed.

---

### Step 2: Set Up Environment Variables

Create a `.env.local` file in the project root directory with the following content:

```env
# Database Connection (REQUIRED)
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/voca_order_taking"

# JWT Authentication (REQUIRED)
JWT_SECRET="your-super-secret-jwt-key-min-32-chars-change-in-production-12345"
JWT_REFRESH_SECRET="your-different-refresh-secret-min-32-chars-change-in-production-67890"

# Password Security
BCRYPT_ROUNDS=12

# OpenAI API (REQUIRED for AI features)
OPENAI_API_KEY="sk-your-openai-api-key-here"

# OpenAI Model Configuration
OPENAI_CHAT_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL="text-embedding-ada-002"
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.7

# Frontend Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"

# Email Configuration (Optional - for email features)
EMAIL_FROM="noreply@voca-ai.com"
EMAIL_SMTP_HOST="smtp.gmail.com"
EMAIL_SMTP_PORT="587"
EMAIL_SMTP_USER=""
EMAIL_SMTP_PASS=""

# Stripe Configuration (Optional - for billing features)
STRIPE_SECRET_KEY_TEST="sk_test_your_stripe_key"
STRIPE_PUBLIC_KEY_TEST="pk_test_your_stripe_key"
STRIPE_ENVIRONMENT=test
```

**Important Notes**:
- Replace `YOUR_PASSWORD` with your PostgreSQL password
- Replace `sk-your-openai-api-key-here` with your actual OpenAI API key
- If you don't have an OpenAI API key, get one from: https://platform.openai.com/api-keys

---

### Step 3: Set Up PostgreSQL Database

#### Option A: Using Existing PostgreSQL Installation

1. **Create the database**:
   ```bash
   psql -U postgres
   CREATE DATABASE voca_order_taking;
   \q
   ```

2. **Update DATABASE_URL** in `.env.local`:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/voca_order_taking"
   ```

#### Option B: Using Docker (Recommended)

```bash
# Start PostgreSQL container
docker run --name voca-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=voca_order_taking \
  -p 5432:5432 \
  -d postgres:15

# Your DATABASE_URL will be:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voca_order_taking"
```

---

### Step 4: Initialize Database Schema

Run Prisma to set up the database tables:

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database
npm run db:push
```

This creates all the necessary tables in your database.

---

### Step 5: Verify Installation

Test your database connection:

```bash
npm run db:test
```

If successful, you should see a success message.

---

### Step 6: Start Development Server

```bash
npm run dev
```

The application will start at: **http://localhost:3000**

---

## 🔧 Troubleshooting

### Issue: "Node.js not found"
**Solution**: Install Node.js from https://nodejs.org/ (version 18+)

### Issue: "PostgreSQL connection failed"
**Solutions**:
1. Make sure PostgreSQL is running:
   - Windows: Check Services, start "postgresql" service
   - Mac/Linux: `sudo service postgresql start`
2. Verify your DATABASE_URL in `.env.local`
3. Check if PostgreSQL is listening on port 5432

### Issue: "Module not found" errors
**Solution**: 
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Prisma Client not generated"
**Solution**:
```bash
npx prisma generate
```

### Issue: "Port 3000 already in use"
**Solution**: 
- Change port: `npm run dev -- -p 3001`
- Or kill the process using port 3000

---

## 📋 Optional Dependencies

These are optional but enhance functionality:

### Redis (Optional - for caching)
- **Install**: https://redis.io/download
- **Or Docker**: `docker run -d -p 6379:6379 redis:7`
- Add to `.env.local`: `REDIS_URL="redis://localhost:6379"`

### Stripe CLI (Optional - for webhook testing)
- **Install**: https://stripe.com/docs/stripe-cli
- Only needed if testing payment webhooks

---

## ✅ Verification Checklist

Before running the app, verify:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] PostgreSQL installed and running
- [ ] Database `voca_order_taking` created
- [ ] `.env.local` file created with all required variables
- [ ] `npm install` completed successfully
- [ ] `npx prisma generate` completed
- [ ] `npm run db:push` completed successfully
- [ ] `npm run db:test` shows connection success

---

## 🎯 Quick Start (TL;DR)

```bash
# 1. Install Node.js 18+ from nodejs.org

# 2. Install PostgreSQL or use Docker:
docker run --name voca-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=voca_order_taking -p 5432:5432 -d postgres:15

# 3. Install dependencies
npm install

# 4. Create .env.local with:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voca_order_taking"
# JWT_SECRET="your-secret-key-min-32-chars"
# JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
# OPENAI_API_KEY="sk-your-key"

# 5. Setup database
npx prisma generate
npm run db:push

# 6. Start server
npm run dev
```

---

## 📚 Additional Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **OpenAI API Docs**: https://platform.openai.com/docs

---

## 🆘 Need Help?

If you encounter issues:
1. Check the error message carefully
2. Verify all prerequisites are installed
3. Ensure `.env.local` has all required variables
4. Check that PostgreSQL is running
5. Review the troubleshooting section above
