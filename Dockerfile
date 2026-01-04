FROM node:18

WORKDIR /app
COPY . .

EXPOSE 3000

CMD sh -c "npm install && npx prisma generate && npm start"
