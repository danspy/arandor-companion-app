# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Note: strict-ssl false is a workaround for SSL certificate issues in some build environments.
# You can try removing this if you have proper SSL certificates configured.
# Alternative: Use a private npm registry with proper certificates
RUN npm config set strict-ssl false && npm ci

# Copy source files (excluding node_modules via .dockerignore)
COPY db ./db
COPY public ./public
COPY src ./src
COPY astro.config.mjs tailwind.config.mjs tsconfig.json ./

# Build the application
ENV ASTRO_DATABASE_FILE=./.astro/content.db
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
# Note: strict-ssl false is a workaround for SSL issues. Remove if not needed.
RUN npm config set strict-ssl false && npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.astro ./.astro

# Create a non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs astro && \
    chown -R astro:nodejs /app

USER astro

# Expose port
EXPOSE 4321

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=4321
ENV ASTRO_DATABASE_FILE=/app/.astro/content.db

# Start the application
CMD ["node", "./dist/server/entry.mjs"]
