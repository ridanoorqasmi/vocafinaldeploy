FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

ENV NODE_ENV=development

CMD ["sh", "-c", "npx next dev -p $PORT -H 0.0.0.0"]
