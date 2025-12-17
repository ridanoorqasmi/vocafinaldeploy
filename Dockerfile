FROM node:18

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy Prisma schema before running generate
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the app
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]