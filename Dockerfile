FROM node:18

WORKDIR /app

COPY package.json package-lock.json ./

# Railway-safe npm install
RUN npm ci --no-audit --no-fund --loglevel=error

COPY . .

RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "dev"]
