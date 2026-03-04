import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

const API_KEY = 'AIzaSyBMUF3JoFjaYzd59fMjQQeIL5Xgmu0772g';

function MediAssist({ theme }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDarkMode = theme === 'dark';

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult('');

    const systemPrompt = `You are a fast, highly concise medical AI. 
Provide extremely concise, practical medical information about the given disease, symptom, or medicine.
Query: "${query}"

RULES:
1. NEVER write in long paragraphs. ALWAYS use very short bullet points.
2. Structure your response rigidly using headers like "### Uses", "### Side Effects", or "### Treatments".
3. CRITICAL: If the query is a disease or symptom (like a cough), YOU MUST include sections for alternative medicine treatments specifically including: "### Modern Medicine", "### Ayurveda Medicine", "### Siddha Medicine", and "### Unani Medicine".
4. Keep the payload small, maximizing speed. Focus on facts.
5. If it's not a health/medical topic, respond with a single sentence declining the query in a polite way.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: systemPrompt }],
              },
            ],
            generationConfig: {
              maxOutputTokens: 600,
              temperature: 0.2,
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        setResult(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('No valid response received');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching the response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const themeStyles = {
    cardBg: isDarkMode ? 'rgba(20, 20, 20, 0.4)' : 'rgba(255, 255, 255, 0.6)',
    glassBorder: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    inputBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    textMuted: isDarkMode ? '#94a3b8' : '#475569',
    textMain: isDarkMode ? '#f8fafc' : '#0f172a',
    primaryColor: '#357abd',
  };

  return (
    <div style={{
      width: '100%',
      minHeight: 'calc(100vh - 80px)',
      background: themeStyles.cardBg,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      padding: '2.5rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box',
      color: themeStyles.textMain
    }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        
        .markdown-wrapper ul { list-style-type: none; padding-left: 0; margin-bottom: 1.5rem; }
        .markdown-wrapper li { position: relative; padding-left: 1.8rem; margin-bottom: 0.8rem; color: ${themeStyles.textMain}; }
        .markdown-wrapper li::before { content: "✦"; position: absolute; left: 0.2rem; color: ${themeStyles.primaryColor}; font-size: 1rem; top: 1px; }
        .markdown-wrapper h3, .markdown-wrapper h2 { color: ${themeStyles.primaryColor}; margin-top: 1.5rem; margin-bottom: 0.8rem; border-bottom: 1px solid ${themeStyles.glassBorder}; padding-bottom: 0.5rem; }
        .markdown-wrapper h3:first-child, .markdown-wrapper h2:first-child { margin-top: 0; }
        .markdown-wrapper strong { font-weight: 600; color: ${themeStyles.textMain}; opacity: 0.9; }
      `}</style>

      <div style={{
        maxWidth: '1000px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        animation: 'slideUp 0.6s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: themeStyles.primaryColor, margin: '0 0 0.5rem 0' }}>MediAssist</h1>
          <p style={{ color: themeStyles.textMuted, fontSize: '1.1rem', margin: 0 }}>Fast, concise medical and drug information</p>
        </div>

        <form
          style={{ display: 'flex', gap: '1rem', flexDirection: 'row', flexWrap: 'wrap' }}
          onSubmit={handleSearch}
        >
          <div style={{ flex: '1', position: 'relative', minWidth: '250px' }}>
            <svg
              style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: themeStyles.textMuted }}
              width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Type a disease (e.g., Cough) or medicine..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              autoFocus
              style={{
                width: '100%',
                padding: '1.2rem 1.5rem 1.2rem 3.5rem',
                fontSize: '1.1rem',
                background: themeStyles.inputBg,
                border: `1px solid ${themeStyles.glassBorder}`,
                borderRadius: '16px',
                color: themeStyles.textMain,
                transition: 'all 0.3s ease',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = themeStyles.primaryColor;
                e.target.style.boxShadow = `0 0 15px rgba(53, 122, 189, 0.15), inset 0 2px 4px rgba(0,0,0,0.05)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = themeStyles.glassBorder;
                e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.05)';
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: '0 2.5rem',
              borderRadius: '16px',
              backgroundColor: loading || !query.trim() ? '#94a3b8' : themeStyles.primaryColor,
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: 600,
              border: 'none',
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              minHeight: '60px',
              opacity: loading || !query.trim() ? 0.7 : 1
            }}
            onMouseOver={(e) => {
              if (!loading && query.trim()) e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '16px',
            padding: '2.5rem',
            animation: 'fadeIn 0.4s ease-out'
          }}>
            <p style={{ color: '#fca5a5', margin: 0 }}>{error}</p>
          </div>
        )}

        {!loading && !result && !error && (
          <div style={{
            textAlign: 'center',
            padding: '4rem 1rem',
            color: themeStyles.textMuted,
            border: `1px dashed ${themeStyles.glassBorder}`,
            borderRadius: '16px'
          }}>
            <svg style={{ marginBottom: '1.5rem', color: themeStyles.primaryColor, opacity: 0.7 }} width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            <h3 style={{ color: themeStyles.textMain, marginBottom: '0.5rem', fontSize: '1.3rem', marginTop: 0 }}>How can I help you today?</h3>
            <p style={{ margin: 0 }}>Enter any health condition or medication name to get started.</p>
          </div>
        )}

        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 0',
            gap: '1.5rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: `3px solid ${themeStyles.glassBorder}`,
              borderLeftColor: themeStyles.primaryColor,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}></div>
            <p style={{ color: themeStyles.textMuted, fontWeight: 500, margin: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
              Scanning medical knowledge base...
            </p>
          </div>
        )}

        {result && !loading && (
          <div style={{
            background: themeStyles.inputBg,
            border: `1px solid ${themeStyles.glassBorder}`,
            borderRadius: '16px',
            padding: '2.5rem',
            animation: 'fadeIn 0.4s ease-out',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
          }}>
            <div className="markdown-wrapper" style={{ lineHeight: 1.6, fontSize: '1.1rem' }}>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MediAssist;
