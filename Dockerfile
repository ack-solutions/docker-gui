FROM node:22-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
FROM base AS deps
RUN yarn install --frozen-lockfile

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js app
RUN yarn build

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app

# Install runtime dependencies for native modules and healthcheck
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    wget \
    dumb-init

ENV NODE_ENV=production

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R node:node /app/data

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json

# Switch to non-root user
USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

