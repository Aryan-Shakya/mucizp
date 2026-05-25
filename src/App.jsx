import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import Player from './components/Player';
import { Music, ListVideo, Heart, Plus, ListMusic, X } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import './index.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api';

function App() {
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); 
  const [activePlaylist, setActivePlaylist] = useState(null);
  
  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);

  const [songToAdd, setSongToAdd] = useState(null); 
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Queue state
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const docRef = doc(db, 'library', 'data');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFavorites(data.favorites || []);
          setPlaylists(data.playlists || []);
        } else {
          const oldRef = doc(db, 'library', 'favorites');
          const oldSnap = await getDoc(oldRef);
          if (oldSnap.exists()) {
            setFavorites(oldSnap.data().songs || []);
          }
        }
      } catch (e) {
        console.error("Error loading from Firebase:", e);
      }
    };
    loadData();
  }, []);

  const syncToFirebase = async (newFavs, newPlaylists) => {
    try {
      await setDoc(doc(db, 'library', 'data'), { favorites: newFavs, playlists: newPlaylists });
    } catch (e) {
      console.error("Error saving to Firebase:", e);
    }
  };

  const handleSearch = async (query) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSongs(data.songs || []);
      setActiveTab('search');
    } catch (err) {
      console.error('Failed to search', err);
    }
    setLoading(false);
  };

  const playSong = async (song, fullQueue = null, index = 0) => {
    setCurrentSong({ ...song, loadingStream: true });
    
    if (fullQueue) {
      setQueue(fullQueue);
      setQueueIndex(index);
    } else {
      const handlePlay = async (song) => {
        setCurrentSong(song);
        // Assuming setIsPlaying and setStreamUrl are available via context or state
        // This is a minimal implementation of the requested change logic within playSong
        const apis = [
          `https://pipedapi.kavin.rocks/streams/${song.id}`,
          `https://pipedapi.smnz.de/streams/${song.id}`,
          `${BACKEND_URL}/stream?video_id=${song.id}`
        ];
        
        for (let api of apis) {
          try {
            const response = await fetch(api);
            const data = await response.json();
            if (data.audioStreams && data.audioStreams.length > 0) {
              const audioStream = data.audioStreams.find(s => s.mimeType.startsWith('audio/webm')) || data.audioStreams[0];
              setCurrentSong({ ...song, streamUrl: audioStream.url, loadingStream: false });
              return;
            } else if (data.url) {
              setCurrentSong({ ...song, streamUrl: data.url, loadingStream: false });
              return;
            }
          } catch (err) {
            console.warn(`Stream API failed, trying next...`, err);
          }
        }
        console.error('All streaming APIs failed');
      };
      
      handlePlay(song);
      setQueue([song]);
      setQueueIndex(0);
    }
  };

  const playNext = () => {
    if (queueIndex < queue.length - 1) {
      playSong(queue[queueIndex + 1], queue, queueIndex + 1);
    }
  };

  const fetchLyrics = async (song) => {
    try {
      const artist = encodeURIComponent(song.artists[0] || '');
      const title = encodeURIComponent(song.title);
      const res = await fetch(`${BACKEND_URL}/lyrics?artist=${artist}&title=${title}`);
      const data = await res.json();
      return data.lyrics;
    } catch (e) {
      return "Failed to load lyrics.";
    }
  };

  const toggleFavorite = (song, e) => {
    e.stopPropagation();
    let newFavs;
    if (favorites.find(f => f.id === song.id)) {
      newFavs = favorites.filter(f => f.id !== song.id);
    } else {
      newFavs = [...favorites, song];
    }
    setFavorites(newFavs);
    syncToFirebase(newFavs, playlists);
  };

  const createPlaylist = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPlaylist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      songs: []
    };
    const newPlaylists = [...playlists, newPlaylist];
    setPlaylists(newPlaylists);
    setNewPlaylistName('');
    syncToFirebase(favorites, newPlaylists);
  };

  const addToPlaylist = (playlistId) => {
    if (!songToAdd) return;
    const newPlaylists = playlists.map(pl => {
      if (pl.id === playlistId) {
        if (!pl.songs.find(s => s.id === songToAdd.id)) {
          return { ...pl, songs: [...pl.songs, songToAdd] };
        }
      }
      return pl;
    });
    setPlaylists(newPlaylists);
    setSongToAdd(null);
    syncToFirebase(favorites, newPlaylists);
  };

  const renderSongList = (list) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {list.map((song, i) => {
          const isFav = favorites.some(f => f.id === song.id);
          return (
            <div 
              key={song.id} 
              className="animate-slide-up" 
              style={{ 
                animationDelay: `${i * 0.05}s`,
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px',
                padding: '12px',
                background: 'var(--card-bg)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                border: currentSong?.id === song.id ? '1px solid var(--accent)' : '1px solid transparent'
              }}
              onClick={() => playSong(song, list, i)}
            >
              <img src={song.thumbnail} alt={song.title} style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{song.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{song.artists.join(', ')}</p>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSongToAdd(song); }}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Add to Playlist"
                >
                  <Plus size={20} />
                </button>
                <button 
                  onClick={(e) => toggleFavorite(song, e)}
                  style={{ background: 'transparent', border: 'none', color: isFav ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Heart size={24} fill={isFav ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-container" style={{ paddingBottom: currentSong ? '120px' : '0' }}>
      <header style={{ padding: '24px', position: 'sticky', top: 0, zIndex: 10 }} className="glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 
            onClick={() => setActiveTab('search')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            <Music color="var(--accent)" /> Mucizp
          </h1>
          <button 
            onClick={() => setActiveTab('library')}
            style={{ background: activeTab === 'library' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
          >
            <ListMusic size={18} /> My Library
          </button>
        </div>
        {activeTab === 'search' && (
          <div style={{ marginTop: '16px' }}>
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>
        )}
      </header>

      <main style={{ padding: '24px' }}>
        {activeTab === 'search' && (
          songs.length > 0 ? renderSongList(songs) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-secondary)' }}>
              <ListVideo size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>Search for a song to start listening</p>
            </div>
          )
        )}

        {activeTab === 'library' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ marginBottom: '16px', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Heart size={20} color="var(--accent)" /> Favorites
              </h2>
              {favorites.length > 0 ? renderSongList(favorites) : <p style={{ color: 'var(--text-secondary)' }}>No favorites yet.</p>}
            </div>

            <div>
              <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Your Playlists</h2>
              <form onSubmit={createPlaylist} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input type="text" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="New playlist name..." style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none' }} />
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Create</button>
              </form>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
                {playlists.map(pl => (
                  <div key={pl.id} onClick={() => { setActivePlaylist(pl); setActiveTab('playlist_view'); }} style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ListMusic size={32} color="var(--text-secondary)" /></div>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{pl.name}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{pl.songs.length} songs</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'playlist_view' && activePlaylist && (
          <div>
            <button onClick={() => setActiveTab('library')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '16px' }}>← Back to Library</button>
            <h2 style={{ marginBottom: '24px', fontSize: '24px' }}>{activePlaylist.name}</h2>
            {activePlaylist.songs.length > 0 ? renderSongList(activePlaylist.songs) : <p style={{ color: 'var(--text-secondary)' }}>This playlist is empty.</p>}
          </div>
        )}
      </main>

      {songToAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ width: '90%', maxWidth: '400px', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Add to Playlist</h3>
              <button onClick={() => setSongToAdd(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            {playlists.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {playlists.map(pl => (
                  <button key={pl.id} onClick={() => addToPlaylist(pl.id)} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>{pl.name} ({pl.songs.length} songs)</button>
                ))}
              </div>
            ) : <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>You haven't created any playlists yet.</p>}
          </div>
        </div>
      )}

      {currentSong && <Player currentSong={currentSong} onNext={playNext} fetchLyrics={fetchLyrics} />}
    </div>
  );
}

export default App;
