FROM node:22-alpine
RUN apk add --no-cache openssl python3 py3-pip ffmpeg && \
    python3 -m pip install --no-cache-dir --break-system-packages yt-dlp yt-dlp-ejs

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN npm run build

CMD ["npm", "run", "docker-start"]