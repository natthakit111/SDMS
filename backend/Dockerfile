# syntax=docker/dockerfile:1

# ── Stage 1: ติดตั้ง dependency (production เท่านั้น) ──────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Puppeteer บน Alpine: ห้ามให้มันดาวน์โหลด Chromium ของตัวเอง (musl libc ไม่รองรับ
# Chromium ที่ Puppeteer bundle มา) ต้องใช้ Chromium ของระบบที่ติดตั้งผ่าน apk แทน
# (ดู backend/src/services/pdf.service.js ที่ตั้งค่า PUPPETEER_EXECUTABLE_PATH ไว้รองรับแล้ว)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: runtime image ─────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Chromium ของระบบ + font/library ที่จำเป็นสำหรับ headless rendering (ใช้ export PDF บิล)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# รันด้วย non-root user ที่ image node:alpine เตรียมไว้ให้อยู่แล้ว
RUN chown -R node:node /app
USER node

EXPOSE 5000
CMD ["node", "server.js"]
