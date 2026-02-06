FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=development
ENV PORT=8080

EXPOSE 8080

CMD ["npx", "next", "dev", "-p", "8080", "-H", "0.0.0.0"]
