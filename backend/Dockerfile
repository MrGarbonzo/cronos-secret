# Runtime-only image. Build is performed outside (tsc) and dist/ is copied in.
# Build context is the repo root (C:\dev\cronosxsecret\), not backend/.
FROM node:20-alpine

WORKDIR /app

# Install production dependencies
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend
COPY backend/dist ./dist

# Copy frontend so express.static at ../../frontend (relative to dist/index.js)
# resolves to /app/frontend
COPY frontend ./frontend

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]
