import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 3) {
        onSearch(query.trim());
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative', width: '100%' }}>
      <input 
        type="text" 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for songs, artists..." 
        style={{
          width: '100%',
          padding: '16px 48px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          background: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--text-primary)',
          fontSize: '16px',
          outline: 'none',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onFocus={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
        onBlur={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
      />
      <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
        <Search size={20} />
      </div>
      {loading && (
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)' }}>
          <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
