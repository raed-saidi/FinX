# Backend Dockerfile
# Build stage
FROM python:3.10.15-slim-bookworm AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --user --no-cache-dir --upgrade pip && \
    pip install --user --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.10.15-slim-bookworm

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -u 1001 appuser

# Copy Python packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Set PATH to include user-installed packages
ENV PATH=/home/appuser/.local/bin:$PATH

WORKDIR /app

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Cloud Run uses PORT env variable
ENV PORT=8080

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
