FROM node:22-trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium xvfb x11vnc openbox socat supervisor fonts-liberation ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/mcp
RUN npm init -y && npm install --omit=dev --save-exact \
    @playwright/mcp@0.0.83 supergateway@4.1.0
RUN useradd -m -u 1001 browser && mkdir -p /profile /downloads \
    && chown browser:browser /profile /downloads
COPY mcp-filter.mjs smoke.mjs /opt/mcp/
COPY supervisord.conf /etc/supervisor/browser.conf
USER browser
ENV DISPLAY=:99 HOME=/home/browser
EXPOSE 8000 5900
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -fsS http://127.0.0.1:9222/json/version > /dev/null && node /opt/mcp/smoke.mjs --health
CMD ["supervisord", "-n", "-c", "/etc/supervisor/browser.conf"]
