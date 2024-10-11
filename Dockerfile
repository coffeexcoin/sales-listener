# base
FROM node:20 AS base

WORKDIR /app

COPY package*.json ./
    
RUN npm install

COPY . .

# for build

FROM base as builder

WORKDIR /app
RUN npm run build

# for production

FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY --from=builder /app/dist ./

ENTRYPOINT ["node","./index.js"]
