from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic
import yt_dlp
import requests
import uvicorn

app = FastAPI(title="Mucizp Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ytmusic = YTMusic()

@app.get("/")
def read_root():
    return {"message": "Mucizp Backend is running!"}

@app.get("/api/search")
@app.get("/search")
def search_songs(q: str):
    try:
        results = ytmusic.search(q, filter="songs")
        songs = []
        for res in results[:10]:
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

# List of yt-dlp client configs to try, in order of reliability
YDL_CONFIGS = [
    {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {'youtube': {'client': ['android_vr']}},
    },
    {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {'youtube': {'client': ['android_creator']}},
    },
    {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {'youtube': {'client': ['tv']}},
    },
    {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {'youtube': {'client': ['mediaconnect']}},
    },
]

@app.get("/api/stream")
@app.get("/stream")
def get_stream_url(video_id: str):
    """Extract audio stream URL using yt-dlp with multiple client fallbacks"""
    url = f"https://music.youtube.com/watch?v={video_id}"
    errors = []
    
    for i, opts in enumerate(YDL_CONFIGS):
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                audio_url = info.get('url')
                if audio_url:
                    return {"url": audio_url}
        except Exception as e:
            errors.append(f"Client {i}: {str(e)[:100]}")
            continue
    
    raise HTTPException(
        status_code=503,
        detail=f"All extraction methods failed: {'; '.join(errors)}"
    )

@app.get("/api/lyrics")
@app.get("/lyrics")
def get_lyrics(artist: str = "", title: str = ""):
    try:
        if not artist or not title:
            return {"lyrics": "Artist and title are required."}
        response = requests.get(
            f"https://api.lyrics.ovh/v1/{artist}/{title}",
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return {"lyrics": data.get("lyrics", "No lyrics found.")}
        else:
            return {"lyrics": "No lyrics found for this song."}
    except requests.exceptions.Timeout:
        return {"lyrics": "Lyrics request timed out."}
    except Exception:
        return {"lyrics": "Could not fetch lyrics."}

if __name__ == "__main__":
    uvicorn.run("api.index:app", host="0.0.0.0", port=7860, reload=True)
