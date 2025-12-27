# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Tiptap Pro token for private registry access
# Set TIPTAP_PRO_TOKEN in Railway environment variables
ARG TIPTAP_PRO_TOKEN

# Create .npmrc with Tiptap Pro registry auth
RUN echo '@tiptap-pro:registry=https://registry.tiptap.dev/' > .npmrc && \
    echo "//registry.tiptap.dev/:_authToken=${TIPTAP_PRO_TOKEN}" >> .npmrc

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (will use .npmrc for Tiptap Pro auth)
RUN npm ci

# Copy source code
COPY . .

# Build frontend and server
RUN npm run build && npm run build:server

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Tiptap Pro token for private registry access (needed for prod dependencies)
ARG TIPTAP_PRO_TOKEN

# Create .npmrc with Tiptap Pro registry auth
RUN echo '@tiptap-pro:registry=https://registry.tiptap.dev/' > .npmrc && \
    echo "//registry.tiptap.dev/:_authToken=${TIPTAP_PRO_TOKEN}" >> .npmrc

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && rm -f .npmrc

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Expose port (Railway sets PORT env var)
EXPOSE 3001

# Start the server
CMD ["npm", "run", "start:server"]
