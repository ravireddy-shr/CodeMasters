# Dockerfile for Code Masters Round 2 Isolated Execution Worker
FROM python:3.12-slim

# Create unprivileged runner user
RUN useradd -m -s /bin/bash sandboxuser

WORKDIR /app

# Copy application files
COPY app/ /app/app/

# Set ownership
RUN chown -R sandboxuser:sandboxuser /app

USER sandboxuser

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

CMD ["python", "-m", "app.runner"]
