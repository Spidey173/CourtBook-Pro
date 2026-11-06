FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including libpq for PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

EXPOSE 5000

ENV FLASK_ENV=development
ENV PYTHONUNBUFFERED=1

CMD ["python", "run.py"]

