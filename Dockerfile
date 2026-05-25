FROM python:3.10-slim

WORKDIR /app

# Install ffmpeg for yt-dlp audio extraction
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ api/

EXPOSE 7860

CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "7860"]
