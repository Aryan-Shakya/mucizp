import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Loader2, Volume2, SkipForward, FileText, X } from 'lucide-react';
import ReactPlayer from 'react-player';

export default function Player({ currentSong, onNext, fetchLyrics }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  useEffect(() => {
    if (currentSong) {
      setIsPlaying(true);
      setLyrics(''); // reset on song change
    }
  }, [currentSong?.id]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    if (audioRef.current) {
      audioRef.current.seekTo(percentage / 100, 'fraction');
      setProgress(percentage);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
  };

  const toggleLyrics = async () => {
    if (!showLyrics) {
      setShowLyrics(true);
      if (!lyrics) {
        setLoadingLyrics(true);
        const text = await fetchLyrics(currentSong);
        setLyrics(text || "No lyrics found.");
        setLoadingLyrics(false);
      }
    } else {
      setShowLyrics(false);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  return (
    <>
      <div className="glass" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 100 }}>
        {/* Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'right' }}>{formatTime(currentTime)}</span>
          <div onClick={handleSeek} style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.1s linear' }} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '40px' }}>{formatTime(duration)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Track Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <img src={currentSong.thumbnail} alt="cover" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {currentSong.title.length > 30 ? currentSong.title.substring(0, 30) + '...' : currentSong.title}
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{currentSong.artists.join(', ')}</p>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flex: 1 }}>
            <button onClick={togglePlay} style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--text-primary)', color: 'var(--bg-color)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}>
              {currentSong.loadingStream ? <Loader2 size={24} className="animate-spin" /> : isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} style={{ marginLeft: '4px' }} />}
            </button>
            <button onClick={onNext} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }} title="Skip Forward">
              <SkipForward size={24} />
            </button>
          </div>

          {/* Extra controls */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)' }}>
            <button onClick={toggleLyrics} style={{ background: 'transparent', border: 'none', color: showLyrics ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Lyrics">
              <FileText size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Volume2 size={20} />
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} style={{ width: '80px', accentColor: 'var(--accent)' }} />
            </div>
          </div>
        </div>
        
        <ReactPlayer 
          ref={audioRef}
          url={`https://www.youtube.com/watch?v=${currentSong.id}`}
          playing={isPlaying}
          volume={volume}
          width="0"
          height="0"
          onProgress={({ played, playedSeconds }) => {
            setProgress(played * 100);
            setCurrentTime(playedSeconds);
          }}
          onDuration={(d) => setDuration(d)}
          onEnded={() => { setIsPlaying(false); onNext(); }}
          onReady={() => setIsPlaying(true)}
          config={{
            youtube: {
              playerVars: { showinfo: 0, controls: 0, disablekb: 1 }
            }
          }}
        />
      </div>

      {/* Lyrics Modal */}
      {showLyrics && (
        <div style={{ position: 'fixed', inset: 0, bottom: '100px', background: 'rgba(0,0,0,0.95)', zIndex: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <button onClick={toggleLyrics} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}><X size={20} /></button>
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>{currentSong.title}</h2>
          <p style={{ color: 'var(--accent)', marginBottom: '32px' }}>{currentSong.artists.join(', ')}</p>
          {loadingLyrics ? (
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '18px', lineHeight: '1.8', textAlign: 'center', color: '#ddd', maxWidth: '600px' }}>
              {lyrics}
            </pre>
          )}
        </div>
      )}
    </>
  );
}
