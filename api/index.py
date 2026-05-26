from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import uvicorn
from pyDes import des, ECB, PAD_PKCS5
import base64
import html

app = FastAPI(title="Mucizp Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Mucizp Backend is running!"}

@app.get("/api/search")
@app.get("/search")
def search_songs(q: str):
    try:
        url = f"https://www.jiosaavn.com/api.php?__call=autocomplete.get&query={q}&_format=json&_marker=0&ctx=web6dot0"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        songs = []
        # JioSaavn autocomplete returns songs in data['songs']['data']
        items = data.get('songs', {}).get('data', [])
        
        for item in items[:15]:
            # Clean up the title (JioSaavn sometimes HTML encodes strings)
            title = html.unescape(item.get('title', ''))
            description = html.unescape(item.get('description', ''))
            
            # The description usually contains "Song by Artist" or just "Artists", let's extract artist if possible
            artists_str = description.replace("Song by ", "").strip()
            # Split by comma if multiple
            artists = [a.strip() for a in artists_str.split(',')] if artists_str else []
            
            # Use high-res image if possible
            image = item.get('image', '').replace("50x50", "500x500")
            
            songs.append({
                "id": item.get('id'),
                "title": title,
                "artists": artists,
                "thumbnail": image,
                "duration": 0, # Duration not available in autocomplete
            })
            
        return {"songs": songs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stream")
@app.get("/stream")
def get_stream_url(video_id: str):
    try:
        url = f"https://www.jiosaavn.com/api.php?__call=song.getDetails&pids={video_id}&_format=json&_marker=0&ctx=web6dot0"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        song_info = data.get('songs', [])[0] if data.get('songs') else {}
        encrypted_url = song_info.get('encrypted_media_url')
        
        if not encrypted_url:
            raise HTTPException(status_code=404, detail="No audio stream found for this ID")
            
        des_cipher = des(b"38346591", ECB, b"\0\0\0\0\0\0\0\0", pad=None, padmode=PAD_PKCS5)
        enc_url = base64.b64decode(encrypted_url.strip())
        dec_url = des_cipher.decrypt(enc_url, padmode=PAD_PKCS5).decode('utf-8')
        
        # Try to get highest quality (320kbps)
        dec_url = dec_url.replace("_96.mp4", "_320.mp4")
        
        return {"url": dec_url}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
