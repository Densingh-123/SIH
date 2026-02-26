import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import API_BASE from '../config/api';
import './SearchPage.css';

// API fetch utility function
const fetchData = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
};

const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0.1);
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loadingMappingId, setLoadingMappingId] = useState(null);

  const [hasSearched, setHasSearched] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [theme, setTheme] = useState('light');
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const API_BASE_URL = API_BASE;

  // Search strategy state
  const [searchStrategy, setSearchStrategy] = useState({
    fuzzy: true,
    fullText: false
  });

  // Progressive loading states
  const [loadingProgress, setLoadingProgress] = useState({
    combined: false,
    ayurveda: false,
    unani: false,
    siddha: false,
    icd11: false,
    suggestions: false
  });

  // Theme toggle effect
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Toggle search strategies
  const toggleSearchStrategy = (strategy) => {
    if (strategy === 'fuzzy') {
      setSearchStrategy(prev => ({
        fuzzy: !prev.fuzzy,
        fullText: prev.fuzzy ? prev.fullText : false
      }));
    } else if (strategy === 'fullText') {
      setSearchStrategy(prev => ({
        fuzzy: prev.fullText ? prev.fuzzy : false,
        fullText: !prev.fullText
      }));
    }
  };

  // Optimized URL builder with faster parameters
  const buildSearchUrl = (term, endpoint = 'combined') => {
    const baseUrl = `${API_BASE_URL}/terminologies/search/${endpoint}/?q=${encodeURIComponent(term)}`;
    const params = new URLSearchParams();
    
    if (searchStrategy.fuzzy) {
      params.append('fuzzy', 'true');
      params.append('threshold', '0.3'); // Increased threshold for faster, more relevant results
    }
    
    if (searchStrategy.fullText) {
      params.append('use_fts', 'true');
    }
    
    // Reduced page size for faster initial load
    params.append('page_size', endpoint === 'combined' ? '20' : '15');
    
    return `${baseUrl}&${params.toString()}`;
  };

  // Fast suggestions fetch with minimal data
  const fetchSuggestions = async (term) => {
    if (!term || term.length < 2) {
      setSuggestions([]);
      setRecommendations([]);
      return;
    }

    try {
      setLoadingProgress(prev => ({ ...prev, suggestions: true }));
      
      // Use a faster endpoint with minimal data
      const url = `${API_BASE_URL}/terminologies/search/combined/?q=${encodeURIComponent(term)}&fuzzy=true&threshold=0.4&page_size=8`;
      const data = await fetchData(url);

      if (data && data.results) {
        const allSuggestions = data.results.map((item, index) => ({
          name: item.title,
          type: 'combined',
          confidence: item.search_score || 0.8,
          id: item.id,
          system: 'icd11',
          definition: item.definition
        }));

        setSuggestions(allSuggestions);
        setRecommendations(allSuggestions.slice(0, 3));
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
      setRecommendations([]);
    } finally {
      setLoadingProgress(prev => ({ ...prev, suggestions: false }));
    }
  };

  // Optimized progressive search with prioritized loading
  const performSearch = async ({ term = searchTerm, system = selectedSystem, confidence = minConfidence } = {}) => {
    if (!term || !term.trim()) return;

    setIsSearching(true);
    
    // Initialize results structure immediately
    setResults({
      combined: { results: [] },
      ayurveda: { results: [] },
      unani: { results: [] },
      siddha: { results: [] },
      icd11: { results: [] },
      mappingResults: []
    });

    try {
      // Phase 1: Load combined data first (highest priority)
      setLoadingProgress(prev => ({ ...prev, combined: true }));
      const combinedUrl = buildSearchUrl(term, 'combined');
      const combinedData = await fetchData(combinedUrl);
      
      // Transform and set combined data immediately
      const mappingResults = combinedData?.results ? combinedData.results.map(item => ({
        mapping_id: item.id,
        source_term: {
          code: item.code,
          english_name: item.title,
          hindi_name: null
        },
        namaste_terms: {
          ayurveda: item.related_ayurveda ? {
            code: item.related_ayurveda.code,
            english_name: item.related_ayurveda.english_name,
            local_name: item.related_ayurveda.local_name
          } : null,
          siddha: item.related_siddha ? {
            code: item.related_siddha.code,
            english_name: item.related_siddha.english_name,
            local_name: item.related_siddha.local_name
          } : null,
          unani: item.related_unani ? {
            code: item.related_unani.code,
            english_name: item.related_unani.english_name,
            local_name: item.related_unani.local_name
          } : null
        },
        icd_mapping: {
          code: item.code,
          title: item.title,
          definition: item.definition,
          class_kind: item.class_kind,
          foundation_uri: item.foundation_uri
        },
        confidence_score: item.mapping_info?.confidence_score || item.search_score || 0.7,
        search_score: item.search_score
      })) : [];

      setResults(prev => ({
        ...prev,
        combined: combinedData || { results: [] },
        mappingResults
      }));
      setLoadingProgress(prev => ({ ...prev, combined: false }));
      setHasSearched(true);

      // Phase 2: Load ICD-11 data (second priority)
      setLoadingProgress(prev => ({ ...prev, icd11: true }));
      const icd11Url = buildSearchUrl(term, 'icd11');
      const icd11Data = await fetchData(icd11Url);
      setResults(prev => ({
        ...prev,
        icd11: icd11Data || { results: [] }
      }));
      setLoadingProgress(prev => ({ ...prev, icd11: false }));

      // Phase 3: Load traditional medicine systems in parallel but update individually
      const traditionalSystems = [
        { key: 'ayurveda', url: `${API_BASE_URL}/terminologies/ayurveda/search/?q=${encodeURIComponent(term)}&threshold=0.2&page_size=12` },
        { key: 'unani', url: `${API_BASE_URL}/terminologies/unani/search/?q=${encodeURIComponent(term)}&threshold=0.2&page_size=12` },
        { key: 'siddha', url: `${API_BASE_URL}/terminologies/siddha/search/?q=${encodeURIComponent(term)}&threshold=0.2&page_size=12` }
      ];

      traditionalSystems.forEach(async (system) => {
        setLoadingProgress(prev => ({ ...prev, [system.key]: true }));
        const systemData = await fetchData(system.url);
        setResults(prev => ({
          ...prev,
          [system.key]: systemData || { results: [] }
        }));
        setLoadingProgress(prev => ({ ...prev, [system.key]: false }));
      });

    } catch (error) {
      console.error("Search error:", error);
      setResults({ 
        combined: { results: [] },
        ayurveda: { results: [] },
        unani: { results: [] },
        siddha: { results: [] },
        icd11: { results: [] },
        mappingResults: [] 
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    await performSearch({ term: searchTerm, system: selectedSystem, confidence: minConfidence });
  };

  // Optimized useEffect for search with better debouncing
  useEffect(() => {
    if (!hasSearched) return;
    if (!searchTerm || !searchTerm.trim()) return;

    const debounceMs = 400; // Increased debounce for better performance
    const timer = setTimeout(() => {
      performSearch({ term: searchTerm, system: selectedSystem, confidence: minConfidence });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [selectedSystem, minConfidence, searchStrategy]);

  // Faster suggestions with optimized debouncing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        fetchSuggestions(searchTerm);
      } else {
        setSuggestions([]);
        setRecommendations([]);
      }
    }, 150); // Reduced debounce for faster suggestions

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  // Optimized detailed view handler
  const handleViewDetails = async (mapping, systemType = 'combined') => {
    const specificTerm = mapping.source_term?.english_name || mapping.title || mapping.english_name || searchTerm;
    
    // Navigate immediately with available data, fetch detailed data in background
    navigate('/mapping-details', { 
      state: { 
        mapping, 
        systemType,
        searchParams: { 
          system: selectedSystem, 
          query: specificTerm, 
          min_confidence: minConfidence,
          search_strategy: searchStrategy 
        },
        searchTerm: specificTerm,
        source: 'comprehensive-search'
      } 
    });
  };

  const handleRowViewDetails = async (mapping) => {
    setLoadingMappingId(mapping.mapping_id);
    await handleViewDetails(mapping, 'mapping');
    setLoadingMappingId(null);
  };

  const handleSystemResultClick = (result, system) => {
    handleViewDetails(result, system);
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion.name);
    setShowSuggestions(false);
    performSearch({ term: suggestion.name, system: selectedSystem, confidence: minConfidence });
  };

  const handleSystemCardClick = (system) => {
    navigate(`/${system}`);
  };

  // Get result counts for overview
  const getResultCounts = () => {
    if (!results) return { combined: 0, ayurveda: 0, unani: 0, siddha: 0, icd11: 0 };
    
    return {
      combined: results.combined?.results?.length || 0,
      ayurveda: results.ayurveda?.results?.length || results.ayurveda?.count || 0,
      unani: results.unani?.results?.length || results.unani?.count || 0,
      siddha: results.siddha?.results?.length || results.siddha?.count || 0,
      icd11: results.icd11?.results?.length || results.icd11?.count || 0
    };
  };

  const resultCounts = getResultCounts();
  const totalResults = Object.values(resultCounts).reduce((sum, count) => sum + count, 0);

  // Optimized system results renderer with loading states
  const renderSystemResults = (systemData, systemName) => {
    const isLoading = loadingProgress[systemName.toLowerCase()];

    if (isLoading) {
      return (
        <div className="loading-section">
          <div className="spinner-small"></div>
          <p>Loading {systemName} data...</p>
        </div>
      );
    }

    if (!systemData?.results?.length) {
      return (
        <div className="no-results">
          <p>No {systemName} data available for "{searchTerm}".</p>
        </div>
      );
    }

    return (
      <div className="system-results-section">
        <h3>{systemName} Results ({systemData.results.length})</h3>
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>English Name</th>
                {systemName === 'Ayurveda' && <th>Hindi Name</th>}
                {systemName === 'Ayurveda' && <th>Diacritical Name</th>}
                {systemName === 'Unani' && <th>Arabic Name</th>}
                {systemName === 'Unani' && <th>Romanized Name</th>}
                {systemName === 'Siddha' && <th>Tamil Name</th>}
                {systemName === 'Siddha' && <th>Romanized Name</th>}
                {systemName === 'ICD-11' && <th>Class Kind</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {systemData.results.slice(0, 8).map((result, index) => ( // Reduced initial display
                <motion.tr 
                  key={result.id || index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }} // Faster animation
                  className="result-row"
                >
                  <td>{result.code || "N/A"}</td>
                  <td className="term-name">{result.english_name || result.title || "N/A"}</td>
                  {systemName === 'Ayurveda' && (
                    <>
                      <td>{result.hindi_name || "-"}</td>
                      <td>{result.diacritical_name || "-"}</td>
                    </>
                  )}
                  {systemName === 'Unani' && (
                    <>
                      <td>{result.arabic_name || "-"}</td>
                      <td>{result.romanized_name || "-"}</td>
                    </>
                  )}
                  {systemName === 'Siddha' && (
                    <>
                      <td>{result.tamil_name || "-"}</td>
                      <td>{result.romanized_name || "-"}</td>
                    </>
                  )}
                  {systemName === 'ICD-11' && (
                    <td>{result.class_kind || "-"}</td>
                  )}
                  <td>
                    <button 
                      className="view-details-btn"
                      onClick={() => handleSystemResultClick(result, systemName.toLowerCase())}
                    >
                      View Details
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {systemData.results.length > 8 && (
            <div className="view-more-section">
              <p>Showing 8 of {systemData.results.length} results</p>
              <button 
                className="view-more-btn"
                onClick={() => handleSystemCardClick(systemName.toLowerCase())}
              >
                View All {systemName} Results
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="search-page">
      <div className="container">
        {/* Header with Theme Toggle */}
        <motion.div
          className="hero-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="search-head">Find Traditional Medicine Mappings</h1>
          <p className="hero-subtitle">Discover connections between traditional medicine systems and modern medical classifications</p>
        </motion.div>
        
        <motion.form 
          onSubmit={handleSearch} 
          className="search-form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="search-input-container">
            <div className="autocomplete-wrapper" ref={suggestionsRef}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Enter disease or condition (e.g., fever, diabetes)"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="search-input-large"
                required
              />
              
              {/* Combined Suggestions and Recommendations Dropdown */}
              <AnimatePresence>
                {showSuggestions && (suggestions.length > 0 || recommendations.length > 0 || loadingProgress.suggestions) && (
                  <motion.div 
                    className="suggestions-dropdown"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {loadingProgress.suggestions ? (
                      <div className="suggestions-loading">
                        <div className="spinner-small"></div>
                        <span>Loading suggestions...</span>
                      </div>
                    ) : suggestions.length > 0 ? (
                      <>
                        <div className="dropdown-label">Search Suggestions</div>
                        {suggestions.slice(0, 6).map((suggestion, index) => ( // Limit suggestions for faster render
                          <div
                            key={index}
                            className="suggestion-item"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            <div className="suggestion-content">
                              <span className="suggestion-text">{suggestion.name}</span>
                              <span className="suggestion-type">ICD-11 Term</span>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : recommendations.length > 0 ? (
                      <div className="recommendations-section">
                        <div className="dropdown-label">Top Recommendations</div>
                        {recommendations.map((recommendation, index) => (
                          <div
                            key={index}
                            className="suggestion-item recommendation-item"
                            onClick={() => handleSuggestionClick(recommendation)}
                          >
                            <div className="suggestion-content">
                              <span className="suggestion-text">{recommendation.name}</span>
                              <span className="suggestion-type">Recommended</span>
                            </div>
                            <span className="suggestion-confidence">
                              {Math.round(recommendation.confidence * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <motion.button 
              type="submit" 
              className="search-button-large"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSearching}
            >
              {isSearching ? (
                <div className="loading-spinner"></div>
              ) : (
                <span>Search</span>
              )}
            </motion.button>
          </div>

          {/* Search Strategy Filters */}
          <div className="filters-container">
            <div className="filter-group">
              <label className="filter-label">Search Strategy</label>
              <div className="filter-buttons">
                <button 
                  type="button"
                  className={`filter-btn ${searchStrategy.fuzzy ? 'active' : ''}`}
                  onClick={() => toggleSearchStrategy('fuzzy')}
                >
                  Fuzzy Search
                </button>
                <button 
                  type="button"
                  className={`filter-btn ${searchStrategy.fullText ? 'active' : ''}`}
                  onClick={() => toggleSearchStrategy('fullText')}
                >
                  Full-Text Search
                </button>
              </div>
              <div className="search-strategy-info">
                {searchStrategy.fuzzy && searchStrategy.fullText ? (
                  <span className="strategy-info-text">
                    Using both Fuzzy and Full-Text search      
                  </span>
                ) : searchStrategy.fuzzy ? (
                  <span className="strategy-info-text">
                    Using Fuzzy search with trigram similarity   
                  </span>
                ) : searchStrategy.fullText ? (
                  <span className="strategy-info-text">
                    Using Full-Text search with search vector  
                  </span>
                ) : (
                  <span className="strategy-info-text warning">
                    Please select at least one search strategy  
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.form>

        <AnimatePresence>
          {results && (
            <motion.div 
              className="results-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="results-header">
                <div className="active-strategies">
                  {searchStrategy.fuzzy && (
                    <span className="strategy-badge fuzzy">Fuzzy Search</span>
                  )}
                  {searchStrategy.fullText && (
                    <span className="strategy-badge fulltext">Full-Text Search</span>
                  )}
                </div>
                
                {totalResults > 0 && (
                  <div className="results-overview">
                    <div className="results-summary">
                      {Object.entries(resultCounts).map(([system, count]) => (
                        count > 0 && (
                          <span key={system} className={`system-count ${loadingProgress[system] ? 'loading' : ''}`}>
                            {system.charAt(0).toUpperCase() + system.slice(1)}: {count}
                            {loadingProgress[system] && <span className="loading-dot"></span>}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {totalResults > 0 ? (
                <div className="comprehensive-results">
                  {/* Combined/ICD-11 Mappings - Show immediately */}
                  {results.mappingResults.length > 0 && (
                    <div className="mapping-results-section">
                      <div className="section-header">
                        <h3>ICD-11 Mappings with Traditional Medicine ({results.mappingResults.length})</h3>
                        {loadingProgress.combined && (
                          <div className="section-loading">
                            <div className="spinner-small"></div>
                            <span>Loading more results...</span>
                          </div>
                        )}
                      </div>
                      <div className="table-container">
                        <table className="results-table">
                          <thead>
                            <tr>
                              <th>ICD-11 code</th>
                              <th>NAME</th>
                              <th>Ayurveda</th>
                              <th>Siddha</th>
                              <th>Unani</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.mappingResults.slice(0, 8).map((mapping, index) => ( // Reduced initial display
                              <motion.tr 
                                key={mapping.mapping_id || index}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.03 }} // Faster animation
                                className="result-row"
                              >
                                <td>
                                  <div className="term-display">
                                    <div className="term-code">{mapping.source_term.code}</div>
                                  </div>
                                </td>
                                <td>
                                  <div className="term-display">
                                    <div className="term-name">{mapping.source_term.english_name}</div>
                                  </div>
                                </td>
                                
                                {['ayurveda', 'siddha', 'unani'].map((system) => (
                                  <td key={system}>
                                    {mapping.namaste_terms[system] ? (
                                      <div className="term-display">
                                        <div className="term-code">{mapping.namaste_terms[system].code}</div>
                                        <div className="term-name">{mapping.namaste_terms[system].english_name}</div>
                                        {mapping.namaste_terms[system].local_name && (
                                          <div className="term-translation">{mapping.namaste_terms[system].local_name}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="no-data">-</span>
                                    )}
                                  </td>
                                ))}
                                
                                <td>
                                  <button 
                                    className="view-details-btn"
                                    onClick={() => handleRowViewDetails(mapping)}
                                    disabled={loadingMappingId === mapping.mapping_id}
                                    title={`View details for ${mapping.source_term.english_name}`}
                                  >
                                    {loadingMappingId === mapping.mapping_id ? (
                                      <div className="loading-spinner"></div>
                                    ) : (
                                      "View Details"
                                    )}
                                  </button>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                        {results.mappingResults.length > 8 && (
                          <div className="view-more-section">
                            <p>Showing 8 of {results.mappingResults.length} mappings</p>
                            <button 
                              className="view-more-btn"
                              onClick={() => performSearch({ term: searchTerm })}
                            >
                              Load More Results
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Add Individual System Results Here */}
                  {['ayurveda', 'siddha', 'unani', 'icd11'].map(system => {
                    const systemData = results[system]?.results;
                    if (!systemData || systemData.length === 0) return null;
                    
                    const systemName = system === 'icd11' ? 'ICD-11' : system.charAt(0).toUpperCase() + system.slice(1);
                    return (
                      <div key={system} className="system-results-section" style={{ marginTop: '2rem' }}>
                        <div className="section-header">
                          <h3>{systemName} Direct Results ({results[system].count || systemData.length})</h3>
                          {loadingProgress[system] && (
                            <div className="section-loading">
                              <div className="spinner-small"></div>
                              <span>Loading...</span>
                            </div>
                          )}
                        </div>
                        <div className="table-container">
                          <table className="results-table">
                            <thead>
                              <tr>
                                <th>Code</th>
                                <th>Name</th>
                                {system !== 'icd11' && <th>Local Name</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {systemData.slice(0, 5).map((item, idx) => (
                                <tr key={item.id || item.code || idx} className="result-row">
                                  <td><div className="term-code">{item.code}</div></td>
                                  <td><div className="term-name">{item.english_name || item.title}</div></td>
                                  {system !== 'icd11' && (
                                    <td>
                                      <div className="term-translation">
                                        {item.hindi_name || item.tamil_name || item.arabic_name || '-'}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {systemData.length > 5 && (
                            <div className="view-more-section">
                              <p>Showing 5 of {results[system].count || systemData.length} results</p>
                              <button 
                                className="view-more-btn"
                                onClick={() => navigate(`/${system === 'icd11' ? 'icd-11' : system}`)}
                              >
                                View all in {systemName} Database
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : hasSearched && !isSearching ? (
                <div className="no-results-message">
                  <h3>No results found for "{searchTerm}"</h3>
                  <p>Try adjusting your search terms or using different search strategies.</p>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          className="quick-access-section"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h3 className="section-title">Quick Access</h3>
          <div className="system-grid">
            {[
              { id: "ayurveda", name: "Ayurveda", desc: "Ancient Indian system of natural healing", img: "img1.png" },
              { id: "siddha", name: "Siddha", desc: "Traditional Tamil system of medicine", img: "img2.png" },
              { id: "unani", name: "Unani", desc: "Greco-Arabic system of medicine", img: "img3.png" },
              { id: "icd11", name: "ICD-11", desc: "International Classification of Diseases", img: "img4.png" }
            ].map((system) => (
              <motion.div 
                key={system.id}
                className="system-card"
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSystemCardClick(system.id)}
              >
                <img 
                  src={system.img} 
                  alt={system.name} 
                  className="system-icon" 
                />
                <h4>{system.name}</h4>
                <p>{system.desc}</p>
                <div className="system-action">Browse {system.name} →</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SearchPage;
