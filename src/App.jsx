import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import Player from './components/Player';
import { Music, ListVideo, Heart, Plus, ListMusic, X } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import './index.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api';

// LocalStorage helpers for reliable fallback
const saveToLocal = (favorites, playlists, history = null) => {
  try {
    localStorage.setItem('mucizp_favorites', JSON.stringify(favorites));
    localStorage.setItem('mucizp_playlists', JSON.stringify(playlists));
    if (history) localStorage.setItem('mucizp_history', JSON.stringify(history));
  } catch (e) { /* ignore quota errors */ }
};

const loadFromLocal = () => {
  try {
    const favorites = JSON.parse(localStorage.getItem('mucizp_favorites') || '[]');
    const playlists = JSON.parse(localStorage.getItem('mucizp_playlists') || '[]');
    const history = JSON.parse(localStorage.getItem('mucizp_history') || '[]');
    return { favorites, playlists, history };
  } catch (e) {
    return { favorites: [], playlists: [], history: [] };
  }
};

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

  const [homeSuggestions, setHomeSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  
  const [recentHistory, setRecentHistory] = useState([]);

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      // First load from localStorage (instant, always works)
      const local = loadFromLocal();
      setFavorites(local.favorites);
      setPlaylists(local.playlists);
      setRecentHistory(local.history);

      // Then try Firebase for cross-device sync
      try {
        const docRef = doc(db, 'library', 'data');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const fbFavs = data.favorites || [];
          const fbPlaylists = data.playlists || [];
          const fbHistory = data.history || [];
          // Use Firebase data if it has content (it's the source of truth for cross-device)
          if (fbFavs.length > 0 || fbPlaylists.length > 0 || fbHistory.length > 0) {
            setFavorites(fbFavs);
            setPlaylists(fbPlaylists);
            setRecentHistory(fbHistory);
            saveToLocal(fbFavs, fbPlaylists, fbHistory);
          }
        }
      } catch (e) {
        console.warn("Firebase unavailable, using local storage:", e.message);
      }
    };
    loadData();

    // Fetch home suggestions
    const fetchSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        // Default search for suggestions (e.g. popular hindi songs)
        const response = await fetch(`${BACKEND_URL}/search?q=top+hindi`);
        const data = await response.json();
        setHomeSuggestions(data.songs || []);
      } catch (err) {
        console.error('Failed to load suggestions', err);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, []);

  const syncData = async (newFavs, newPlaylists, newHistory) => {
    // Always save to localStorage (reliable)
    saveToLocal(newFavs, newPlaylists, newHistory);
    
    // Try to sync to Firebase (cross-device)
    try {
      await setDoc(doc(db, 'library', 'data'), { 
        favorites: newFavs, 
        playlists: newPlaylists,
        history: newHistory || []
      });
    } catch (e) {
      console.warn("Firebase sync failed:", e.message);
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
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const playSong = async (song, fullQueue = null, index = 0) => {
    setCurrentSong({ ...song, loadingStream: false });
    
    setRecentHistory(prev => {
      const newHistory = [song, ...prev.filter(s => s.id !== song.id)].slice(0, 20);
      syncData(favorites, playlists, newHistory);
      return newHistory;
    });

    if (fullQueue) {
      setQueue(fullQueue);
      setQueueIndex(index);
    } else {
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
      // Remove text after parentheses, brackets, or hyphens to improve lyrics matching
      const cleanTitle = song.title.replace(/(\(|\[|-).*$/, '').trim();
      const title = encodeURIComponent(cleanTitle);
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
    syncData(newFavs, playlists, recentHistory);
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
    syncData(favorites, newPlaylists, recentHistory);
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
    syncData(favorites, newPlaylists, recentHistory);
  };

  const importYouTubePlaylist = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim() || importing) return;
    
    const listMatch = youtubeUrl.match(/[?&]list=([^#\&\?]+)/);
    if (!listMatch) {
      alert("Invalid YouTube Playlist URL. Must contain 'list='");
      return;
    }
    const playlistId = listMatch[1];
    
    setImporting(true);
    setImportProgress({ current: 0, total: 0, status: 'Fetching playlist from YouTube...' });
    
    try {
      const res = await fetch(`${BACKEND_URL}/youtube?id=${playlistId}`);
      if (!res.ok) throw new Error("Failed to fetch playlist");
      const ytData = await res.json();
      
      const tracks = ytData.songs || [];
      if (tracks.length === 0) throw new Error("Playlist is empty or private");
      
      setImportProgress({ current: 0, total: tracks.length, status: `Searching for ${tracks.length} songs...` });
      
      const newPlaylist = {
        id: Date.now().toString(),
        name: ytData.title + ' (YouTube)',
        songs: []
      };
      
      for (let i = 0; i < tracks.length; i++) {
        setImportProgress({ current: i, total: tracks.length, status: `Searching: ${tracks[i].title}...` });
        try {
          const query = `${tracks[i].title} ${tracks[i].artist}`.trim();
          const searchRes = await fetch(`${BACKEND_URL}/search?q=${encodeURIComponent(query)}`);
          const searchData = await searchRes.json();
          if (searchData.songs && searchData.songs.length > 0) {
            newPlaylist.songs.push(searchData.songs[0]);
          }
        } catch(e) {
          console.warn("Failed to find song", tracks[i].title);
        }
      }
      
      const newPlaylists = [...playlists, newPlaylist];
      setPlaylists(newPlaylists);
      syncData(favorites, newPlaylists, recentHistory);
      
      setYoutubeUrl('');
      setImportProgress({ current: tracks.length, total: tracks.length, status: 'Import complete!' });
      setTimeout(() => setImportProgress(null), 3000);
      
    } catch (err) {
      alert("Error importing playlist: " + err.message);
      setImportProgress(null);
    } finally {
      setImporting(false);
    }
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
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>{getGreeting()}</h2>
              <h3 style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Trending Suggestions</h3>
              {loadingSuggestions ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading suggestions...</p>
              ) : homeSuggestions.length > 0 ? (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                  gap: '20px' 
                }}>
                  {homeSuggestions.slice(0, 10).map((song, i) => (
                    <div 
                      key={song.id} 
                      className="animate-slide-up"
                      onClick={() => playSong(song, homeSuggestions, i)}
                      style={{ 
                        animationDelay: `${i * 0.05}s`,
                        background: 'rgba(255, 255, 255, 0.05)', 
                        padding: '16px', 
                        borderRadius: '12px', 
                        cursor: 'pointer',
                        transition: 'background 0.2s, transform 0.2s',
                        border: currentSong?.id === song.id ? '1px solid var(--accent)' : '1px solid transparent'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    >
                      <img src={song.thumbnail} alt={song.title} style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', objectFit: 'cover', marginBottom: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} />
                      <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artists.join(', ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '30vh', color: 'var(--text-secondary)' }}>
                  <ListVideo size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p>Search for a song to start listening</p>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'library' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ marginBottom: '16px', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Music size={20} color="var(--accent)" /> Recently Played
              </h2>
              {recentHistory.length > 0 ? (
                <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', scrollbarWidth: 'none' }}>
                  {recentHistory.map((song, i) => (
                    <div 
                      key={`hist-${song.id}`} 
                      onClick={() => playSong(song, recentHistory, i)}
                      style={{ 
                        minWidth: '120px', 
                        width: '120px', 
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '8px',
                        borderRadius: '8px',
                        border: currentSong?.id === song.id ? '1px solid var(--accent)' : '1px solid transparent'
                      }}
                    >
                      <img src={song.thumbnail} alt={song.title} style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', objectFit: 'cover', marginBottom: '8px' }} />
                      <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artists.join(', ')}</p>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--text-secondary)' }}>No recent history.</p>}
            </div>

            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ marginBottom: '16px', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Heart size={20} color="var(--accent)" /> Favorites
              </h2>
              {favorites.length > 0 ? renderSongList(favorites) : <p style={{ color: 'var(--text-secondary)' }}>No favorites yet.</p>}
            </div>

            <div>
              <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Your Playlists</h2>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Import from YouTube</h3>
                <form onSubmit={importYouTubePlaylist} style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="Paste YouTube Playlist URL..." style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none' }} disabled={importing} />
                    <button type="submit" disabled={importing} style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', fontWeight: '600', cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1 }}>
                      {importing ? 'Importing...' : 'Import'}
                    </button>
                  </div>
                  {importProgress && (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <p>{importProgress.status}</p>
                      {importProgress.total > 0 && (
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${(importProgress.current / importProgress.total) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }}></div>
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </div>

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
            <button onClick={() => setActiveTab('library')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '16px' }}>&larr; Back to Library</button>
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
