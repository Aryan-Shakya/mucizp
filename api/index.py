from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import uvicorn
from pyDes import des, ECB, PAD_PKCS5
import base64
import html
from ytmusicapi import YTMusic

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
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "X-Forwarded-For": "103.116.251.10" # Indian IP
        }
        
        # 1. Fetch autocomplete (guarantees global top hits, bypassing region blocks)
        url_auto = f"https://www.jiosaavn.com/api.php?__call=autocomplete.get&query={q}&_format=json&_marker=0&ctx=web6dot0"
        res_auto = requests.get(url_auto, headers=headers, timeout=10)
        
        # 2. Fetch full search (provides 15+ results, but prone to region block cover songs on Vercel US)
        url_full = f"https://www.jiosaavn.com/api.php?__call=search.getResults&q={q}&n=15&p=1&_format=json&_marker=0&ctx=web6dot0"
        res_full = requests.get(url_full, headers=headers, timeout=10)
        
        try:
            data_auto = res_auto.json()
            data_full = res_full.json()
        except Exception:
            raise HTTPException(status_code=502, detail="Failed to parse JioSaavn search response.")
        
        songs = []
        seen_ids = set()
        
        # Parse Autocomplete
        auto_items = data_auto.get('songs', {}).get('data', [])
        for item in auto_items:
            id = item.get('id')
            if not id or id in seen_ids: continue
            
            title = html.unescape(item.get('title', ''))
            desc = html.unescape(item.get('description', ''))
            artists_str = desc.split('·')[0].split('-')[0].strip() if desc else ""
            artists = [artists_str] if artists_str else []
            image = item.get('image', '').replace("50x50", "500x500").replace("150x150", "500x500")
            
            songs.append({
                "id": id,
                "title": title,
                "artists": artists,
                "thumbnail": image,
                "duration": 0,
            })
            seen_ids.add(id)
            
        # Parse Full Search (sort by play_count just in case)
        full_items = data_full.get('results', [])
        full_items = sorted(full_items, key=lambda x: int(x.get('play_count', 0)) if str(x.get('play_count', 0)).isdigit() else 0, reverse=True)
        
        for item in full_items:
            id = item.get('id')
            if not id or id in seen_ids: continue
            
            title = html.unescape(item.get('song', item.get('title', '')))
            artists_str = item.get('singers') or item.get('primary_artists') or ""
            artists_str = html.unescape(artists_str)
            artists = [a.strip() for a in artists_str.split(',')] if artists_str else []
            image = item.get('image', '').replace("150x150", "500x500").replace("50x50", "500x500")
            try:
                duration = int(item.get('duration', 0))
            except:
                duration = 0
                
            songs.append({
                "id": id,
                "title": title,
                "artists": artists,
                "thumbnail": image,
                "duration": duration,
            })
            seen_ids.add(id)
            
        return {"songs": songs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stream")
@app.get("/stream")
def get_stream_url(video_id: str, quality: str = "high"):
    try:
        url = f"https://www.jiosaavn.com/api.php?__call=song.getDetails&pids={video_id}&_format=json&_marker=0&ctx=web6dot0"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "X-Forwarded-For": "103.116.251.10"
        }
        response = requests.get(url, headers=headers, timeout=10)
        
        try:
            data = response.json()
        except Exception:
            raise HTTPException(status_code=502, detail="Failed to parse JioSaavn response. Possibly blocked by Cloudflare.")
        
        song_info = data.get('songs', [])[0] if data.get('songs') else {}
        encrypted_url = song_info.get('encrypted_media_url')
        
        if not encrypted_url:
            raise HTTPException(status_code=404, detail="No audio stream found for this ID")
            
        des_cipher = des(b"38346591", ECB, b"\0\0\0\0\0\0\0\0", pad=None, padmode=PAD_PKCS5)
        enc_url = base64.b64decode(encrypted_url.strip())
        dec_url = des_cipher.decrypt(enc_url, padmode=PAD_PKCS5).decode('utf-8')
        
        # Default is 96kbps. If high quality requested, replace with 320kbps.
        if quality != "low":
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

@app.get("/api/youtube")
@app.get("/youtube")
def get_youtube_playlist(id: str):
    try:
        ytmusic = YTMusic()
        if id.startswith("RD"):
            # It's a YouTube Mix playlist, which requires get_watch_playlist
            playlist = ytmusic.get_watch_playlist(playlistId=id)
            playlist_title = "YouTube Mix"
        else:
            playlist = ytmusic.get_playlist(id)
            playlist_title = playlist.get('title', 'YouTube Playlist')
            
        songs = []
        for track in playlist.get('tracks', []):
            title = track.get('title', '')
            artists = [a.get('name', '') for a in track.get('artists', [])]
            if title:
                songs.append({
                    "title": title,
                    "artist": artists[0] if artists else ""
                })
                
        return {
            "title": playlist_title,
            "songs": songs
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch playlist: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("api.index:app", host="0.0.0.0", port=7860, reload=True)
