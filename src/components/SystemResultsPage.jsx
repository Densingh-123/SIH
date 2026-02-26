/* eslint-disable react/prop-types */
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import './SystemResultsPage.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

/* ---------- tiny helper ---------- */
const fetchJSON = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
};

/* ===================================================================
    DRAWER  –  shows full details for a single code
   =================================================================== */
const DetailsDrawer = ({ code, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  useEffect(() => {
    let stale = false;
    const get = async () => {
      try {
        setLoading(true);
        const [icd, ayur, sidd, unan, map] = await Promise.allSettled([
          fetchJSON(`${API_BASE}/terminologies/icd11/${encodeURIComponent(code)}`),
          fetchJSON(`${API_BASE}/terminologies/ayurveda/${encodeURIComponent(code)}`),
          fetchJSON(`${API_BASE}/terminologies/siddha/${encodeURIComponent(code)}`),
          fetchJSON(`${API_BASE}/terminologies/unani/${encodeURIComponent(code)}`),
          fetchJSON(`${API_BASE}/terminologies/mappings/${encodeURIComponent(code)}`),
        ]);
        if (stale) return;
        setData({
          icd: icd.status === 'fulfilled' ? icd.value : null,
          ayur: ayur.status === 'fulfilled' ? ayur.value : null,
          sidd: sidd.status === 'fulfilled' ? sidd.value : null,
          unan: unan.status === 'fulfilled' ? unan.value : null,
          map: map.status === 'fulfilled' ? map.value : null,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    get();
    return () => (stale = true);
  }, [code]);

  return (
    <motion.div
      className="details-drawer"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 24 }}
    >
      {/* ---- header ---- */}
      <div className="drawer-header">
        <h3>Full Details – {code}</h3>
        <button className="close-drawer" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {/* ---- body ---- */}
      <div className="drawer-body">
        {loading ? (
          <div className="drawer-loader">
            <div className="spinner" />
            <p>Loading ICD-11 ↔ Traditional Medicine Mappings…</p>
          </div>
        ) : (
          <>
            {data.icd && (
              <section className="detail-block icd-block">
                <h4>ICD-11</h4>
                <div className="detail-grid">
                  <span className="label">Title</span>
                  <span className="value">{data.icd.title || '—'}</span>

                  <span className="label">Definition</span>
                  <p className="value">{data.icd.definition || '—'}</p>

                  <span className="label">Class kind</span>
                  <span className="value">{data.icd.class_kind || '—'}</span>

                  <span className="label">Browser</span>
                  {data.icd.foundation_uri ? (
                    <a href={data.icd.foundation_uri} target="_blank" rel="noreferrer" className="external-link">
                      Open ICD-11 ↗
                    </a>
                  ) : (
                    <span className="value">—</span>
                  )}
                </div>
              </section>
            )}

            {data.ayur && (
              <section className="detail-block ayur-block">
                <h4>Ayurveda</h4>
                <div className="detail-grid">
                  <span className="label">English</span>
                  <span className="value">{data.ayur.english_name || '—'}</span>
                  <span className="label">Hindi</span>
                  <span className="value">{data.ayur.hindi_name || '—'}</span>
                  <span className="label">Diacritical</span>
                  <span className="value">{data.ayur.diacritical_name || '—'}</span>
                </div>
              </section>
            )}

            {data.sidd && (
              <section className="detail-block sidd-block">
                <h4>Siddha</h4>
                <div className="detail-grid">
                  <span className="label">English</span>
                  <span className="value">{data.sidd.english_name || '—'}</span>
                  <span className="label">Tamil</span>
                  <span className="value">{data.sidd.tamil_name || '—'}</span>
                  <span className="label">Romanised</span>
                  <span className="value">{data.sidd.romanized_name || '—'}</span>
                </div>
              </section>
            )}

            {data.unan && (
              <section className="detail-block unan-block">
                <h4>Unani</h4>
                <div className="detail-grid">
                  <span className="label">English</span>
                  <span className="value">{data.unan.english_name || '—'}</span>
                  <span className="label">Arabic</span>
                  <span className="value">{data.unan.arabic_name || '—'}</span>
                  <span className="label">Romanised</span>
                  <span className="value">{data.unan.romanized_name || '—'}</span>
                </div>
              </section>
            )}

            {data.map && (
              <section className="detail-block map-block">
                <h4>Mapping confidence</h4>
                <div className="detail-grid">
                  <span className="label">Score</span>
                  <span className="value">
                    {data.map.confidence_score ? `${(data.map.confidence_score * 100).toFixed(1)} %` : '—'}
                  </span>
                  <span className="label">Algorithm</span>
                  <span className="value">{data.map.algorithm || '—'}</span>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

/* ===================================================================
    MAIN PAGE
   =================================================================== */
const SystemResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { system, searchTerm, results: prefilledResults } = location.state || {};

  const [data, setData] = useState(prefilledResults || null);
  const [isLoading, setIsLoading] = useState(!prefilledResults);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [theme, setTheme] = useState('light');
  const [drawerCode, setDrawerCode] = useState(null); // open when not null

  /* ---------- theme ---------- */
  useEffect(() => {
    const t = localStorage.getItem('theme') || 'light';
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    const handler = (e) => {
      if (e.key === 'theme') {
        const nt = localStorage.getItem('theme') || 'light';
        setTheme(nt);
        document.documentElement.setAttribute('data-theme', nt);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  /* ---------- data fetch ---------- */
  useEffect(() => {
    if (!system || !searchTerm) {
      navigate('/search');
      return;
    }
    if (prefilledResults) {
      setIsLoading(false);
      return;
    }
    const get = async () => {
      setIsLoading(true);
      try {
        let url;
        if (system === 'combined') {
          url = `${API_BASE}/terminologies/search/combined/?q=${encodeURIComponent(searchTerm)}&fuzzy=true&threshold=0.2&page_size=100`;
        } else if (system === 'icd11') {
          url = `${API_BASE}/terminologies/icd11/search/?q=${encodeURIComponent(searchTerm)}&fuzzy=true&threshold=0.2&page_size=100`;
        } else {
          url = `${API_BASE}/terminologies/${system}/search/?q=${encodeURIComponent(searchTerm)}&threshold=0.1`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
        setData({ results: [], count: 0 });
      } finally {
        setIsLoading(false);
      }
    };
    get();
  }, [system, searchTerm, prefilledResults, navigate]);

  /* ---------- pagination ---------- */
  const pageData = useMemo(() => {
    if (!data?.results?.length) return [];
    const start = (currentPage - 1) * itemsPerPage;
    return data.results.slice(start, start + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (!data?.results?.length) return 0;
    return Math.ceil(data.results.length / itemsPerPage);
  }, [data, itemsPerPage]);

  const handlePage = (p) => {
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---------- empty / loading ---------- */
  if (isLoading)
    return (
      <div className="system-results-page">
        <div className="container">
          <div className="loading-state">
            <div className="spinner" />
            <p>
              Loading {system} results for “{searchTerm}”…
            </p>
          </div>
        </div>
      </div>
    );

  /* ---------- render ---------- */
  return (
    <div className="system-results-page">
      <div className="container">
        <header className="page-header">
          <button onClick={() => navigate(-1)} className="back-btn">
            ← Back to Results
          </button>
          <div className="header-content">
            <h1 className="page-title">
              {system === 'combined' ? 'ICD-11 Mappings' : system.charAt(0).toUpperCase() + system.slice(1)}
            </h1>
            <p className="search-query">Search: “{searchTerm}”</p>
          </div>
        </header>

        <div className="content-area">
          {/* 1.  Combined card layout */}
          {system === 'combined' && (
            <motion.div className="combined-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="results-header">
                <h2>ICD-11 ↔ Traditional Medicine Mappings</h2>
                <p className="results-count">
                  {data.count || data.results.length} mapped terms found for “{searchTerm}”
                </p>
              </div>

              <div className="combined-grid">
                {pageData.map((it, idx) => (
                  <motion.div
                    key={it.id || idx}
                    className="combined-card"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -5, scale: 1.02 }}
                  >
                    {/* ICD-11 Section */}
                    <div className="icd-section">
                      <div className="section-header">
                        <span className="system-badge icd-badge">ICD-11</span>
                        <span className="item-code">{it.code}</span>
                      </div>
                      <h3 className="item-title">{it.title}</h3>
                      <p className="definition-preview">
                        {it.definition ? `${it.definition.substring(0, 150)}…` : 'No definition available'}
                      </p>
                      {it.foundation_uri && (
                        <a href={it.foundation_uri} target="_blank" rel="noreferrer" className="external-link">
                          View in ICD-11 Browser ↗
                        </a>
                      )}
                    </div>

                    {/* Mappings */}
                    <div className="mappings-section">
                      <h4>Traditional Medicine Mappings</h4>
                      <div className="mapping-grid">
                        {['ayurveda', 'siddha', 'unani'].map((sys) => (
                          <div key={sys} className="mapping-item">
                            <span className="system-label">{sys.charAt(0).toUpperCase() + sys.slice(1)}</span>
                            {it[`related_${sys}`] ? (
                              <div className="mapping-details">
                                <div className="mapping-code">{it[`related_${sys}`].code}</div>
                                <div className="mapping-name">{it[`related_${sys}`].english_name}</div>
                                {it[`related_${sys}`].local_name && (
                                  <div className="mapping-local">{it[`related_${sys}`].local_name}</div>
                                )}
                              </div>
                            ) : (
                              <div className="no-mapping">No mapping available</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="card-footer">
                      <div className="card-meta">
                        {it.search_score && (
                          <span className="confidence-score">Relevance: {(it.search_score * 100).toFixed(1)}%</span>
                        )}
                        {it.mapping_info && (
                          <span className="mapping-confidence">
                            Mapping confidence: {(it.mapping_info.confidence_score * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <button className="view-details-btn" onClick={() => setDrawerCode(it.code)}>
                        View Full Details →
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button className="pagination-btn" onClick={() => handlePage(1)} disabled={currentPage === 1}>
                    First
                  </button>
                  <button className="pagination-btn" onClick={() => handlePage(currentPage - 1)} disabled={currentPage === 1}>
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(Math.max(0, currentPage - 3), currentPage + 2)
                    .map((n) => (
                      <button
                        key={n}
                        className={`pagination-btn ${n === currentPage ? 'active' : ''}`}
                        onClick={() => handlePage(n)}
                      >
                        {n}
                      </button>
                    ))}

                  <button className="pagination-btn" onClick={() => handlePage(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next
                  </button>
                  <button className="pagination-btn" onClick={() => handlePage(totalPages)} disabled={currentPage === totalPages}>
                    Last
                  </button>

                  <span className="pagination-info">
                    Page {currentPage} of {totalPages} ({data.results.length} total items)
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* 2.  Table layout for other systems */}
          {system !== 'combined' && (
            <motion.div className="table-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="results-header">
                <h2>{system.charAt(0).toUpperCase() + system.slice(1)} Results</h2>
                <p className="results-count">{data.count || data.results.length} terms found for “{searchTerm}”</p>
              </div>

              <div className="table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>English Name</th>
                      {system === 'ayurveda' && (
                        <>
                          <th>Hindi Name</th>
                          <th>Diacritical Name</th>
                        </>
                      )}
                      {system === 'siddha' && (
                        <>
                          <th>Tamil Name</th>
                          <th>Romanised Name</th>
                        </>
                      )}
                      {system === 'unani' && (
                        <>
                          <th>Arabic Name</th>
                          <th>Romanised Name</th>
                        </>
                      )}
                      {system === 'icd11' && (
                        <>
                          <th>Class Kind</th>
                          <th>Foundation URI</th>
                        </>
                      )}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((it, idx) => (
                      <motion.tr key={it.id || idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}>
                        <td>
                          <div className="code-cell">{it.code || '—'}</div>
                        </td>
                        <td>
                          <div className="name-cell">{it.english_name || it.title || '—'}</div>
                        </td>
                        {system === 'ayurveda' && (
                          <>
                            <td>{it.hindi_name || '—'}</td>
                            <td>{it.diacritical_name || '—'}</td>
                          </>
                        )}
                        {system === 'siddha' && (
                          <>
                            <td>{it.tamil_name || '—'}</td>
                            <td>{it.romanized_name || '—'}</td>
                          </>
                        )}
                        {system === 'unani' && (
                          <>
                            <td>{it.arabic_name || '—'}</td>
                            <td>{it.romanized_name || '—'}</td>
                          </>
                        )}
                        {system === 'icd11' && (
                          <>
                            <td>{it.class_kind || '—'}</td>
                            <td>
                              {it.foundation_uri ? (
                                <a href={it.foundation_uri} target="_blank" rel="noreferrer" className="uri-link">
                                  View
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          </>
                        )}
                        <td>
                          <button className="view-details-btn small" onClick={() => setDrawerCode(it.code)}>
                            Details
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button className="pagination-btn" onClick={() => handlePage(1)} disabled={currentPage === 1}>
                    First
                  </button>
                  <button className="pagination-btn" onClick={() => handlePage(currentPage - 1)} disabled={currentPage === 1}>
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(Math.max(0, currentPage - 3), currentPage + 2)
                    .map((n) => (
                      <button
                        key={n}
                        className={`pagination-btn ${n === currentPage ? 'active' : ''}`}
                        onClick={() => handlePage(n)}
                      >
                        {n}
                      </button>
                    ))}

                  <button className="pagination-btn" onClick={() => handlePage(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next
                  </button>
                  <button className="pagination-btn" onClick={() => handlePage(totalPages)} disabled={currentPage === totalPages}>
                    Last
                  </button>

                  <span className="pagination-info">
                    Page {currentPage} of {totalPages} ({data.results.length} total items)
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* ---------- drawer portal ---------- */}
      <AnimatePresence>{drawerCode && <DetailsDrawer code={drawerCode} onClose={() => setDrawerCode(null)} />}</AnimatePresence>
    </div>
  );
};

export default SystemResultsPage;