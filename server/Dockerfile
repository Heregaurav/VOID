FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /usr/src/app/dist ./dist

# Keep public directory for file uploads
RUN mkdir -p public/uploads

EXPOSE 5000

ENV PORT=5000

CMD ["node", "dist/index.js"]
