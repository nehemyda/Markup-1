# Vpin's Node server for Cloudflare Containers (see wrangler.jsonc). Built from the output of `npm run build`.
FROM node:24-slim

# Chrome for pin screenshots and project previews; zip for the WordPress plugin download
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji fonts-noto-cjk zip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY dist ./dist
COPY wordpress-plugin ./wordpress-plugin

ENV NODE_ENV=production \
    PORT=8080 \
    CHROME_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=1
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
