from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic
import requests
import uvicorn

app = FastAPI(title="Mucizp Backend")

# Allow frontend to access the API
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
        # Search for songs specifically to get clean audio tracks
        results = ytmusic.search(q, filter="songs")
        
        songs = []
        for res in results[:10]:  # Return top 10 results
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

@app.get("/api/lyrics")
@app.get("/lyrics")
def get_lyrics(artist: str = "", title: str = ""):
    """Fetch lyrics using lyrics.ovh free API"""
    try:
        if not artist or not title:
            return {"lyrics": "Artist and title are required."}
        
        # Try lyrics.ovh API
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
    except Exception as e:
        return {"lyrics": f"Could not fetch lyrics."}

if __name__ == "__main__":
    uvicorn.run("api.index:app", host="0.0.0.0", port=7860, reload=True)
