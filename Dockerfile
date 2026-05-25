FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY api/ api/

# Hugging Face Spaces requires port 7860
EXPOSE 7860

# Start the FastAPI server
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "7860"]
