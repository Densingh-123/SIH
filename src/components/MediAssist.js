import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import API_BASE from '../config/api';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

function MediAssist({ theme }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemResults, setSystemResults] = useState({
    ayurveda: null,
    siddha: null,
    unani: null,
    icd11: null
  });
  const [activeSystemTab, setActiveSystemTab] = useState(null);

  const isDarkMode = theme === 'dark';

  const fetchSystem = async (system, searchTerm) => {
    let endpoint = '';
    if (system === 'icd11') {
      endpoint = `${API_BASE}/terminologies/icd11/search/?fuzzy=true&q=${encodeURIComponent(searchTerm)}`;
    } else {
      endpoint = `${API_BASE}/terminologies/${system}/search/?q=${encodeURIComponent(searchTerm)}`;
    }
    
    try {
      const res = await fetch(endpoint);
      if(!res.ok) return [];
      const data = await res.json();
      console.log(`[${system}] Data:`, data); // Debug logging
      if(data && data.results) return Array.isArray(data.results) ? data.results : [];
      if(Array.isArray(data)) return data;
      return [];
    } catch(e) {
      console.error(`Error fetching ${system}:`, e);
      return [];
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult('');
    setSystemResults({ ayurveda: null, siddha: null, unani: null, icd11: null });
    setActiveSystemTab(null);

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
      // Parallel fetch for Gemini AI + Local System Endpoints
      const fetchAI = async () => {
        if (!API_KEY) {
          return { ok: false, json: async () => ({}) };
        }
        try {
          return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }],
              generationConfig: { maxOutputTokens: 600, temperature: 0.2 }
            })
          });
        } catch (e) {
          return { ok: false, json: async () => ({}) };
        }
      };

      const [aiResponse, ayuData, sidData, unaData, icdData] = await Promise.all([
        fetchAI(),
        fetchSystem('ayurveda', query),
        fetchSystem('siddha', query),
        fetchSystem('unani', query),
        fetchSystem('icd11', query)
      ]);

      // Handle Component State
      setSystemResults({
        ayurveda: ayuData,
        siddha: sidData,
        unani: unaData,
        icd11: icdData
      });

      // Handle AI Res
      if (!aiResponse.ok) {
        console.warn('AI Response not OK, falling back to db results.');
        setResult('Definition service unavailable at the moment. Please refer to the clinical database results below.');
      } else {
        const data = await aiResponse.json();
        if (data.candidates && data.candidates.length > 0) {
          setResult(data.candidates[0].content.parts[0].text);
        } else {
          setResult('No specific AI summarization available for this query. Please check clinical references below.');
        }
      }

    } catch (err) {
      console.error("Critical search error:", err);
      // Even if AI completely fails, we still want to show the results we got so far visually, so don't clear them completely, just set error text
      setError('An error occurred while fetching the response. Showing partial data if available.');
      if (!result) setResult('AI search failed.');
    } finally {
      setLoading(false);
    }
  };

  const themeStyles = {
    cardBg: isDarkMode ? 'rgba(20, 20, 20, 0.4)' : 'rgba(255, 255, 255, 0.6)',
    glassBorder: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    inputBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(240, 244, 248, 0.7)',
    textMuted: isDarkMode ? '#94a3b8' : '#475569',
    textMain: isDarkMode ? '#f8fafc' : '#0f172a',
    primaryColor: '#357abd',
    resultBoxBg: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
    resultBoxHover: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
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
        
        /* Custom Scrollbar */
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.3); border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,100,100,0.5); }
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
              placeholder="Type a disease (e.g., Fever) or medicine..."
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
              Scanning medical knowledge base & databases...
            </p>
          </div>
        )}

        {/* AI Results */}
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

        {/* Clinical Reference Database Results */}
        {result && !loading && (
          <div style={{ marginTop: '1rem', animation: 'fadeIn 0.6s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
              <h3 style={{ color: themeStyles.textMain, margin: 0 }}>Clinical References</h3>
              <div style={{ flex: 1, height: '1px', background: themeStyles.glassBorder }}></div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              {Object.entries({
                'Modern Medicine (ICD-11)': { key: 'icd11', data: systemResults.icd11 },
                'Ayurveda': { key: 'ayurveda', data: systemResults.ayurveda },
                'Siddha': { key: 'siddha', data: systemResults.siddha },
                'Unani': { key: 'unani', data: systemResults.unani }
              }).map(([title, info]) => {
                const hasData = info.data && info.data.length > 0;
                const isActive = activeSystemTab === info.key;
                
                return (
                  <motion.div
                    key={info.key}
                    whileHover={hasData ? { y: -3, boxShadow: '0 8px 15px rgba(0,0,0,0.1)' } : {}}
                    whileTap={hasData ? { scale: 0.98 } : {}}
                    onClick={() => hasData && setActiveSystemTab(isActive ? null : info.key)}
                    style={{
                      background: isActive ? themeStyles.primaryColor : themeStyles.resultBoxBg,
                      color: isActive ? 'white' : themeStyles.textMain,
                      border: `1px solid ${isActive ? themeStyles.primaryColor : themeStyles.glassBorder}`,
                      borderRadius: '14px',
                      padding: '1.5rem',
                      cursor: hasData ? 'pointer' : 'default',
                      transition: 'background 0.3s, color 0.3s',
                      textAlign: 'center',
                      opacity: hasData ? 1 : 0.5,
                      boxShadow: isActive ? `0 10px 20px rgba(53, 122, 189, 0.3)` : '0 4px 6px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{title}</h4>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.9rem', 
                      fontWeight: isActive ? 600 : 400,
                      opacity: isActive ? 1 : 0.8 
                    }}>
                      {!info.data ? 'Loading...' : hasData ? `${info.data.length} Results Found` : 'No Results'}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Expanded Tab Content */}
            <AnimatePresence>
              {activeSystemTab && systemResults[activeSystemTab] && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: '1.5rem',
                    background: themeStyles.resultBoxBg,
                    border: `1px solid ${themeStyles.glassBorder}`,
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h4 style={{ color: themeStyles.primaryColor, margin: 0, fontSize: '1.3rem' }}>
                        {activeSystemTab === 'icd11' ? 'ICD-11' : activeSystemTab.charAt(0).toUpperCase() + activeSystemTab.slice(1)} Database Results
                      </h4>
                      <button 
                        onClick={() => setActiveSystemTab(null)}
                        style={{
                          background: 'none', border: 'none', color: themeStyles.textMuted, cursor: 'pointer',
                          fontSize: '1.5rem', padding: '0 0.5rem', lineHeight: 1
                        }}
                      >&times;</button>
                    </div>

                    <div className="custom-scroll" style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '1rem', 
                      maxHeight: '400px', 
                      overflowY: 'auto',
                      paddingRight: '1rem'
                    }}>
                      {systemResults[activeSystemTab].map((item, idx) => (
                        <div key={idx} style={{ 
                          padding: '1.5rem', 
                          background: themeStyles.inputBg, 
                          borderRadius: '12px',
                          border: `1px solid ${themeStyles.glassBorder}`
                        }}>
                          {Object.entries(item).filter(([k, v]) => v && k !== 'id').slice(0, 6).map(([k, v]) => (
                            <div key={k} style={{ 
                              fontSize: '1rem', 
                              marginBottom: '0.6rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem'
                            }}>
                              <strong style={{ 
                                color: themeStyles.primaryColor,
                                fontSize: '0.85rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {k.replace(/_/g, ' ')}
                              </strong>
                              <span style={{ color: themeStyles.textMain, wordBreak: 'break-word', lineHeight: 1.5 }}>
                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

export default MediAssist;