FROM node:20-alpine

# Puppeteer + Alpine: Chromium ที่ Puppeteer ดาวน์โหลดเองใช้กับ Alpine (musl libc) ไม่ได้
# จึงติดตั้ง Chromium ของระบบผ่าน apk แทน แล้วสั่ง Puppeteer ให้ข้ามการดาวน์โหลด Chromium ของตัวเอง
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN mkdir -p uploads/meter-images uploads/payment-slips uploads/contracts uploads/profiles logs
EXPOSE 5000
CMD ["node", "server.js"]