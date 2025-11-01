# Fabric Gateway Dockerfile - Use golang base with Node installed
FROM golang:1.22-bullseye

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get install -y --no-install-recommends \
       python3 \
       make \
       g++ \
       openssl \
       curl \
       git \
    && rm -rf /var/lib/apt/lists/*

# Set Go environment - ensure Go binaries are in PATH
ENV GOPATH="/go" \
    GO111MODULE=on \
    PATH="/usr/local/go/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Create wallet directory
RUN mkdir -p wallet logs

# Create non-root user (Debian)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["node", "src/app.js"]
