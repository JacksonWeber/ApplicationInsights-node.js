# Multi-stage build for ApplicationInsights Node.js SDK
# Stage 1: Build stage
FROM node:lts-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json* ./

# Copy source code first (needed for prepare script)
COPY . .

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Build the TypeScript project (may be redundant due to prepare script, but ensures build)
RUN npm run build:compile

# Stage 2: Production stage
FROM node:lts-alpine AS production

# Set environment
ENV NODE_ENV=production

# Set working directory
WORKDIR /usr/src/app

# Copy package files and modify to remove prepare script
COPY package.json package-lock.json* ./

# Temporarily remove the prepare script to avoid build issues during production install
RUN sed -i '/"prepare":/d' package.json

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage to root level
COPY --from=builder /usr/src/app/out /out

# Copy the agents/nodejs folder for runtime availability at /agents
COPY --from=builder /usr/src/app/agents /agents

# Install npm dependencies in agents/nodejs and replace applicationinsights with our build
WORKDIR /agents/nodejs
RUN npm install

# Ensure azure-monitor-opentelemetry-exporter is installed (should be included from package.json dependencies)
RUN npm install azure-monitor-opentelemetry-exporter-1.0.0-beta.34.tgz

# Replace the applicationinsights package in node_modules with our compiled code
RUN rm -rf node_modules/applicationinsights && \
    mkdir -p node_modules/applicationinsights && \
    cp -r /out node_modules/applicationinsights/out

# Copy package.json from the root to the applicationinsights module for proper module resolution
COPY --from=builder /usr/src/app/package.json node_modules/applicationinsights/package.json

# Go back to the main working directory
WORKDIR /usr/src/app

# Copy any other necessary files (optional, only if needed at runtime)
# COPY --from=builder /usr/src/app/src ./src
# COPY --from=builder /usr/src/app/tsconfig.json ./tsconfig.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
