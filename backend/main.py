from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic
import yt_dlp
import uvicorn
import requests

app = FastAPI(title="Mucizp Backend")

# Allow frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ytmusic = YTMusic()

@app.get("/")
def read_root():
    return {"message": "Mucizp Backend is running!"}

@app.get("/search")
def search_songs(q: str):
    try:
        # Search for songs specifically to get clean audio tracks
        results = ytmusic.search(q, filter="songs")
        
        songs = []
        for res in results[:10]: # Return top 10 results
            if 'videoId' in res:
                songs.append({
                    "id": res['videoId'],
                    "title": res['title'],
                    "artists": [a['name'] for a in res.get('artists', [])],
                    "thumbnail": res['thumbnails'][-1]['url'] if res.get('thumbnails') else "",
                    "duration": res.get('duration', ""),
                })
        return {"songs": songs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stream")
def get_stream_url(video_id: str):
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            'format': 'bestaudio/best',
            'noplaylist': True,
            'quiet': True
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            audio_url = info['url']
            return {"url": audio_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
