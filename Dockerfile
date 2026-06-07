# ==========================================
# STAGE 1: Build Dependencies
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package configurations
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# ==========================================
# STAGE 2: Lightweight Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy node modules from build stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json

# Copy server logic and public assets
COPY server.js ./
COPY public/ ./public/

# Create data directory and set proper permissions for security
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-root user for security containerization
USER node

# Expose port
EXPOSE 3000

# Health check to ensure service viability
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/todos').then(res => res.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

# Start execution
CMD ["npm", "start"]
