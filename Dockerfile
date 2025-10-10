FROM node:22-bookworm-slim AS base

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libjpeg62-turbo-dev \
    libpango1.0-dev \
    libgif-dev \
    libsqlite3-dev \
    git \
  && rm -rf /var/lib/apt/lists/*

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
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install runtime dependencies and init process
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    dumb-init \
    wget \
    libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R node:node /app/data

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Switch to non-root user
USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "yarn db:migrate && yarn db:seed && node server.js"]
