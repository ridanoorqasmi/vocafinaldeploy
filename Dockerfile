FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

ENV NODE_ENV=development
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx next dev -p 3000 -H 0.0.0.0"]
