FROM python:3.12-slim

# Sends Python logs directly to Docker without buffering.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

# Installs backend dependencies inside the Docker image.
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# Runs one stable backend worker without development reload mode.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
