FROM node:18

WORKDIR /app

# Install deps first (fast + stable)
COPY package.json package-lock.json ./
RUN npm ci

# Copy everything
COPY . .

# Generate Prisma client (safe in dev)
RUN npx prisma generate

EXPOSE 3000

# Dev server (acceptable for dev deploy)
CMD ["npm", "run", "dev"]
