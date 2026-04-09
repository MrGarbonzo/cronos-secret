# Runtime-only image. Build is performed outside (tsc) and dist/ is copied in.
# Build context is the repo root (C:\dev\cronosxsecret\), not backend/.
FROM node:20-alpine

# Mirror the source tree layout (cronosxsecret/backend + cronosxsecret/frontend)
# so express.static at ../../frontend (relative to dist/index.js) resolves
# identically in dev and in the container.
WORKDIR /app/backend

# Install production dependencies
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend
COPY backend/dist ./dist

# Sibling to /app/backend — matches ../../frontend from /app/backend/dist/index.js
COPY frontend /app/frontend

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]
