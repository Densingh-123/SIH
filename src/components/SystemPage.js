import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import API_BASE from '../config/api';
import './SystemPage.css';

// ----------  utility  ----------
const fetchData = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('fetch error', e);
    return null;
  }
};

// ----------  main component  ----------
const SystemPage = ({ systemName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [suggPage, setSuggPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadRes, setUploadRes] = useState(null);
  const [isAboutVisible, setIsAboutVisible] = useState(true); // Force visibility
  const resultsPerPage = 10;
  const suggPerPage = 10;
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const dropdownRef = useRef(null);
  const aboutSectionRef = useRef(null);

  // Current user state
  const [currentUser, setCurrentUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setUserChecked(true);
    });
    return unsub;
  }, []);

  // Force About section to be visible on mount and when system changes
  useEffect(() => {
    setIsAboutVisible(true);
    // Ensure About section is in view after render
    setTimeout(() => {
      if (aboutSectionRef.current) {
        aboutSectionRef.current.style.opacity = '1';
        aboutSectionRef.current.style.visibility = 'visible';
      }
    }, 100);
  }, [systemName]);

  // Admin check - only allow specific admin user
  const isAdmin = currentUser?.displayName === 'root' && currentUser?.email === 'root@gmail.com';

  // Check if user is logged in (for upload permissions)
  const isLoggedIn = !!currentUser;

  // ----------  system config  ----------
  const systemData = {
    ayurveda: {
      title: 'Ayurveda',
      description: 'Ancient Indian system of natural and holistic healing',
      image: '/img5.png',
      searchEp: `${API_BASE}/terminologies/ayurveda/search/?q=`,
      csvEp: `${API_BASE}/terminologies/ayurveda/csv/upload/`,
      autoEp: `${API_BASE}/terminologies/ayurveda/autocomplete/?q=`,
      about: `Ayurveda, the "science of life", is a 5,000-year-old healing tradition...`,
      benefits: [
        'Truly personalised medicine based on your unique mind-body type',
        'Natural herbs & oils – minimal side-effects, gentle detox',
        'Seasonal & daily routines that prevent disease before it starts'
      ]
    },
    siddha: {
      title: 'Siddha',
      description: 'One of the oldest traditional medicine systems from South India',
      image: '/img3.png',
      searchEp: `${API_BASE}/terminologies/siddha/search/?q=`,
      csvEp: `${API_BASE}/terminologies/siddha/csv/upload/`,
      autoEp: `${API_BASE}/terminologies/siddha/autocomplete/?q=`,
      about: `Siddha is a Tamil healing tradition believed to have been transmitted by the 18 Siddhars...`,
      benefits: [
        'Unique Naadi-pariksha (pulse diagnosis) reveals deep imbalances early',
        'Kaya-kalpa therapies that rejuvenate cells and prolong healthy lifespan',
        'Varmam energy-point therapy for instant pain relief & vitality'
      ]
    },
    unani: {
      title: 'Unani',
      description: 'Greco-Arabic system of medicine based on the teachings of Hippocrates',
      image: '/img3.png',
      searchEp: `${API_BASE}/terminologies/unani/search/?q=`,
      csvEp: `${API_BASE}/terminologies/unani/csv/upload/`,
      autoEp: `${API_BASE}/terminologies/unani/autocomplete/?q=`,
      about: `Unani-Tibb is an elegant fusion of Greek, Arabic, Persian and Indian medical wisdom...`,
      benefits: [
        'Temperament-based prescriptions – right drug for the right person',
        'Non-surgical detox via wet-cupping (Hijamat) and leech therapy',
        'Potent herb-mineral syrups (Joshanda, Khamira) for quick relief'
      ]
    },
    icd11: {
      title: 'ICD-11',
      description: 'International Classification of Diseases 11th Revision',
      image: '/img4.png',
      searchEp: `${API_BASE}/terminologies/icd11/search/?fuzzy=true&q=`,
      csvEp: null,
      autoEp: `${API_BASE}/terminologies/icd11/autocomplete/?q=`,
      about: `ICD-11 is the global standard for recording, analysing and reporting health conditions...`,
      benefits: [
        'Global language for disease documentation and tele-medicine',
        'Digital-ready URI-based codes for EHR & mobile apps',
        'Built-in traditional medicine chapter for AYUSH integration'
      ]
    },
    mappings: {
      title: 'Mappings',
      description: 'Cross-links between AYUSH systems and ICD-11 codes',
      image: '/img6.png',
      searchEp: `${API_BASE}/terminologies/mappings/?system=`,
      csvEp: null,
      autoEp: null,
      about: `Mappings help connect Ayurveda, Siddha, Unani and ICD-11 terms for unified healthcare data exchange...`,
      benefits: [
        'Bridge traditional & modern healthcare terminologies',
        'Enable interoperability in electronic health records',
        'Support research by linking diverse medical systems'
      ]
    }
  };

  const system = systemData[systemName];

  // ----------  autocomplete with enhanced pagination  ----------
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggTotal, setSuggTotal] = useState(0);
  const [suggLoading, setSuggLoading] = useState(false);
  const [suggTotalPages, setSuggTotalPages] = useState(1);
  const [allSuggestions, setAllSuggestions] = useState([]);

  const fetchAllSuggestions = async (term) => {
    if (!term || term.length < 2) {
      setAllSuggestions([]);
      setSuggestions([]);
      setSuggTotal(0);
      setSuggTotalPages(1);
      return;
    }
    setSuggLoading(true);
    try {
      const data = await fetchData(
        `${system.autoEp}${encodeURIComponent(term)}&limit=1000`
      );
      let allData = [];
      if (data && Array.isArray(data.results)) allData = data.results;
      else if (Array.isArray(data)) allData = data;
      setAllSuggestions(allData);
      setSuggTotal(allData.length);
      setSuggTotalPages(Math.ceil(allData.length / suggPerPage));
      updateDisplayedSuggestions(allData, 1);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setAllSuggestions([]);
      setSuggestions([]);
      setSuggTotal(0);
      setSuggTotalPages(1);
    } finally {
      setSuggLoading(false);
    }
  };

  const updateDisplayedSuggestions = (allData, page) => {
    const start = (page - 1) * suggPerPage;
    const end   = start + suggPerPage;
    setSuggestions(allData.slice(start, end));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setSuggPage(1);
      fetchAllSuggestions(searchTerm);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (allSuggestions.length) updateDisplayedSuggestions(allSuggestions, suggPage);
  }, [suggPage, allSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target)
      )
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ----------  search  ----------
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    setCurrentPage(1);
    try {
      // Updated endpoint handling for mappings
      const searchUrl = systemName === 'mappings' 
        ? `${system.searchEp}${encodeURIComponent(searchTerm)}`
        : `${system.searchEp}${encodeURIComponent(searchTerm)}`;
      
      const data = await fetchData(searchUrl);
      let res = [];
      if (data && data.results) res = Array.isArray(data.results) ? data.results : [];
      else if (Array.isArray(data)) res = data;
      setResults(res);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setTimeout(() => handleSearch(), 100);
  };

  // ----------  csv upload with enhanced authentication checks  ----------
  const handleFilePick = () => {
    if (!userChecked) {
      alert('Please wait while we check your authentication status...');
      return;
    }
    
    if (!isLoggedIn) {
      alert('Please log in to upload files');
      return;
    }
    
    if (!isAdmin) {
      alert('Only admin users can upload files');
      return;
    }
    
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !system.csvEp) return;

    // Double-check authentication before upload
    if (!isLoggedIn) {
      alert('Please log in to upload files');
      e.target.value = '';
      return;
    }

    if (!isAdmin) {
      alert('Only admin users can upload files');
      e.target.value = '';
      return;
    }

    setUploading(true);
    setUploadRes(null);
    const form = new FormData();
    form.append('file', file);
    form.append('update_search_vector', 'true');
    try {
      const res = await fetch(system.csvEp, { method: 'POST', body: form });
      const json = await res.json();
      setUploadRes(json);
    } catch (err) {
      setUploadRes({ error: 'Network or server error' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ----------  navigation / table helpers  ----------
  const handleRowClick = (item) => {
    navigate('/view-details', {
      state: { item, system: system.title, query: searchTerm, timestamp: new Date().toISOString() }
    });
  };

  // Define allowed headers for ICD-11 - ADDED display_name
  const allowedIcd11Headers = ['code', 'title', 'display_name', 'definition', 'class_kind'];

  const getTableHeaders = (items) => {
    if (!items || !items.length) return [];
    
    // For ICD-11, return only allowed headers
    if (systemName === 'icd11') {
      return allowedIcd11Headers;
    }
    
    // For other systems, return all headers
    const keys = new Set();
    items.forEach((item) => Object.keys(item).forEach((k) => keys.add(k)));
    return Array.from(keys);
  };

  const renderTableCell = (value) => {
    if (value == null) return '-';
    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      return str.length > 100 ? str.slice(0, 100) + '…' : str;
    }
    if (typeof value === 'string' && value.length > 100) return value.slice(0, 100) + '…';
    return value;
  };

  const totalPages = Math.ceil(results.length / resultsPerPage);
  const currentResults = results.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ----------  suggestion pagination  ----------
  const handleSuggPage = (page) => {
    if (page < 1 || page > suggTotalPages) return;
    setSuggPage(page);
  };

  const renderSuggPagination = () => {
    if (suggTotalPages <= 1) return null;
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, suggPage - Math.floor(maxVisible / 2));
    let end   = Math.min(suggTotalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
      pages.push(
        <button key={i} className={`sugg-page-btn ${suggPage === i ? 'active' : ''}`} onClick={() => handleSuggPage(i)}>
          {i}
        </button>
      );
    }
    const startItem = (suggPage - 1) * suggPerPage + 1;
    const endItem   = Math.min(suggPage * suggPerPage, suggTotal);
    return <div className="sugg-pagination-info">Showing {startItem}-{endItem} of {suggTotal}</div>;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Get upload icon title based on authentication status
  const getUploadIconTitle = () => {
    if (!userChecked) return 'Checking authentication...';
    if (!isLoggedIn) return 'Please log in to upload files';
    if (!isAdmin) return 'Only admin can upload files';
    return 'Upload CSV to update database';
  };

  // Get upload icon class based on authentication status
  const getUploadIconClass = () => {
    if (!userChecked || uploading) return 'upload-icon checking';
    if (!isLoggedIn || !isAdmin) return 'upload-icon disabled';
    return 'upload-icon';
  };

  // ----------  render  ----------
  return (
    <div className="system-page">
      <div className="containers">
        {/* header */}
        <motion.div className="system-header">
          <motion.div className="system-icon-large">
            <img src={system.image} alt={system.title} style={{ width: '120px', height: '120px', objectFit: 'contain', borderRadius: '80px' }} />
          </motion.div>
          <div className="system-info">
            <h2>{system.title}</h2>
            <p>{system.description}</p>
          </div>
        </motion.div>

        {/* search bar with upload icon */}
        <motion.form onSubmit={handleSearch} className="search-forms" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <div className="search-input-container">
            <div className="autocomplete-wrapper" ref={suggestionsRef}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${system.title} treatments (e.g., fever, diabetes)`}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                className="search-inputs"
              />

              {/* suggestions dropdown */}
              {showSuggestions && searchTerm.length >= 2 && (
                <div className="suggestions-dropdown" ref={dropdownRef}>
                  {suggLoading ? (
                    <div className="suggestions-loading">Loading suggestions...</div>
                  ) : suggestions.length > 0 ? (
                    <>
                      {suggestions.map((s, i) => (
                        <div
                          key={i}
                          className="suggestion-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSuggestionClick(s);
                          }}
                          title={`Click to search for "${s}"`}
                        >
                          <span className="suggestion-text">{s}</span>
                        </div>
                      ))}
                      {renderSuggPagination()}
                    </>
                  ) : (
                    <div className="suggestions-empty">No suggestions found for "{searchTerm}"</div>
                  )}
                </div>
              )}
            </div>

            {/* upload icon with enhanced authentication checks */}
            {system.csvEp && (
              <div className="upload-group">
                <img
                  src="https://cdn-icons-png.flaticon.com/256/10024/10024501.png"
                  alt="upload"
                  className={getUploadIconClass()}
                  onClick={handleFilePick}
                  title={getUploadIconTitle()}
                />
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
              </div>
            )}

            <motion.button
              type="submit"
              className="search-buttons"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isSearching || !searchTerm.trim()}
            >
              {isSearching ? <div className="loading-spinner" /> : 'Search'}
            </motion.button>
          </div>
        </motion.form>

        {/* upload feedback */}
        <AnimatePresence>
          {uploadRes && (
            <motion.div className="upload-feedback" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {uploadRes.error ? (
                <span className="upload-error">Upload failed: {uploadRes.error}</span>
              ) : (
                <span className="upload-success">
                  <img src="https://i.imgur.com/4QZhF9u.png" alt="success" className="success-tick" />
                  {uploadRes.summary || `Created: ${uploadRes.created || 0} | Updated: ${uploadRes.updated || 0} | Skipped: ${uploadRes.skipped || 0}`}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* results table */}
        {currentResults.length > 0 && (
          <motion.div className="system-results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h3>
              {system.title} Results for "{searchTerm}"
              <small style={{ fontSize: '0.8em', marginLeft: '10px', color: 'var(--text-muted)' }}>
                (Showing {((currentPage - 1) * resultsPerPage) + 1}-{Math.min(currentPage * resultsPerPage, results.length)} of {results.length} results)
              </small>
            </h3>

            <div className="mapping-table-container">
              <table className="mapping-table">
                <thead>
                  <tr>
                    {getTableHeaders(currentResults).map((k) => (
                      <th key={k}>{k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentResults.map((item, idx) => (
                    <motion.tr
                      key={item.code || item.id || idx}
                      className="mapping-row clickable-row"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => handleRowClick(item)}
                      title="Click to view details"
                    >
                      {getTableHeaders(currentResults).map((k) => (
                        <td key={k}>{renderTableCell(item[k])}</td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
                  First
                </button>
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                  Prev
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={currentPage === pageNum ? 'active-page' : ''}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                  Next
                </button>
                <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>
                  Last
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* about / benefits - ALWAYS VISIBLE */}
        <motion.div 
          ref={aboutSectionRef}
          className="system-info-content always-visible"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{ 
            opacity: isAboutVisible ? 1 : 0,
            visibility: isAboutVisible ? 'visible' : 'hidden'
          }}
        >
          <h3>About {system.title}</h3>
          <p>{system.about}</p>

          <div className="system-benefits">
            <h4>Key Benefits</h4>
            <ul>
              {system.benefits.map((b, index) => (
                <li key={index}>{b}</li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SystemPage;