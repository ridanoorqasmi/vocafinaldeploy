FROM node:18

WORKDIR /app

# Copy everything
COPY . .

EXPOSE 3000

# Install deps + generate prisma at runtime, not build time
CMD sh -c "npm install && npx prisma generate && npm run dev"
