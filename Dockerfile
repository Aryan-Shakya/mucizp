FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Install system dependencies (required for yt-dlp)
RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY api/ api/

# Hugging Face Spaces strictly require the app to run on port 7860
EXPOSE 7860

# Start the FastAPI server
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "7860"]
