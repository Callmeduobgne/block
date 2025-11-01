# Backend Phase 3 - Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
        git \
        wget \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Hyperledger Fabric CA Client
ARG FABRIC_CA_VERSION=1.5.9
RUN wget https://github.com/hyperledger/fabric-ca/releases/download/v${FABRIC_CA_VERSION}/hyperledger-fabric-ca-linux-amd64-${FABRIC_CA_VERSION}.tar.gz \
    && tar -xzf hyperledger-fabric-ca-linux-amd64-${FABRIC_CA_VERSION}.tar.gz \
    && mv bin/fabric-ca-client /usr/local/bin/ \
    && chmod +x /usr/local/bin/fabric-ca-client \
    && rm -rf bin hyperledger-fabric-ca-linux-amd64-${FABRIC_CA_VERSION}.tar.gz \
    && fabric-ca-client version

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000"]
