import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import API_BASE from '../config/api';
import "./MappingDetailsPage.css";

// Cache for API responses to avoid redundant calls
const apiCache = new Map();

const fetchData = async (url, useCache = true) => {
  // Check cache first
  if (useCache && apiCache.has(url)) {
    return apiCache.get(url);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    // Cache the response
    if (useCache) {
      apiCache.set(url, data);
    }
    
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
};

// Optimized function to fetch data with pagination support
const fetchPaginatedData = async (baseUrl, searchTerm, system = null, page = 1, pageSize = 10) => {
  let url = null;

  // Construct URL based on system type with optimized parameters
  if (system === 'combined') {
    url = `${baseUrl}/terminologies/search/combined/?q=${encodeURIComponent(searchTerm)}&fuzzy=true&threshold=0.2&use_fts=true&page=${page}&page_size=${pageSize}`;
  } else if (system === 'icd11') {
    url = `${baseUrl}/terminologies/icd11/search/?q=${encodeURIComponent(searchTerm)}&fuzzy=true&threshold=0.2&page=${page}&page_size=${pageSize}`;
  } else if (system) {
    url = `${baseUrl}/terminologies/${system}/search/?q=${encodeURIComponent(searchTerm)}&threshold=0.2&page=${page}&page_size=${pageSize}`;
  }

  if (!url) return { results: [], count: 0, next: null, previous: null };

  try {
    const data = await fetchData(url);
    if (data) {
      return {
        results: data.results || [],
        count: data.count || 0,
        next: data.next,
        previous: data.previous
      };
    }
    return { results: [], count: 0, next: null, previous: null };
  } catch (error) {
    console.error(`Error fetching ${system} data:`, error);
    return { results: [], count: 0, next: null, previous: null };
  }
};

// Function to fetch all pages for a system (for detailed view)
const fetchAllPagesForSystem = async (baseUrl, searchTerm, system, maxPages = 3) => {
  let allResults = [];
  let page = 1;
  let hasMore = true;
  const pageSize = 50; // Larger page size for detailed view

  while (hasMore && page <= maxPages) {
    const data = await fetchPaginatedData(baseUrl, searchTerm, system, page, pageSize);
    if (data.results && data.results.length > 0) {
      allResults = [...allResults, ...data.results];
      hasMore = !!data.next;
      page++;
    } else {
      hasMore = false;
    }
  }

  return { results: allResults, count: allResults.length };
};

const MappingDetailsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { mapping, searchParams, additionalData, searchTerm, item, system, source, systemType } = location.state || {};
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allData, setAllData] = useState({
    combined: { results: [], count: 0, next: null, currentPage: 1 },
    ayurveda: { results: [], count: 0, next: null, currentPage: 1 },
    unani: { results: [], count: 0, next: null, currentPage: 1 },
    siddha: { results: [], count: 0, next: null, currentPage: 1 },
    icd11: { results: [], count: 0, next: null, currentPage: 1 }
  });
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailedData, setDetailedData] = useState(null);
  const [theme, setTheme] = useState('light');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [loadingProgress, setLoadingProgress] = useState({
    combined: false,
    ayurveda: false,
    unani: false,
    siddha: false,
    icd11: false
  });

  const API_BASE_URL = API_BASE;
  const loadedTermsRef = useRef(new Set());

  // Sync theme with localStorage and header
  useEffect(() => {
    const updateTheme = () => {
      const savedTheme = localStorage.getItem('theme') || 'light';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    };

    updateTheme();

    const handleStorageChange = (e) => {
      if (e.key === 'theme') {
        updateTheme();
      }
    };

    const handleThemeChange = (e) => {
      if (e.detail && e.detail.theme) {
        setTheme(e.detail.theme);
        localStorage.setItem('theme', e.detail.theme);
        document.documentElement.setAttribute('data-theme', e.detail.theme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('themeChange', handleThemeChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('themeChange', handleThemeChange);
    };
  }, []);

  // Load more results for a specific system (pagination)
  const loadMoreResults = async (systemKey) => {
    if (!allData[systemKey]?.next || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = (allData[systemKey].currentPage || 1) + 1;
      const newData = await fetchPaginatedData(API_BASE_URL, searchTerm, systemKey === 'icd11' ? 'icd11' : systemKey, nextPage, 10);

      if (newData.results) {
        setAllData(prev => ({
          ...prev,
          [systemKey]: {
            results: [...prev[systemKey].results, ...newData.results],
            count: newData.count,
            next: newData.next,
            currentPage: nextPage
          }
        }));
      }
    } catch (error) {
      console.error(`Error loading more ${systemKey} results:`, error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Progressive data loading - load data system by system
  useEffect(() => {
    const loadDataProgressively = async () => {
      if (!searchTerm) return;

      setIsLoading(true);
      
      // Load combined data first (most important) with page=1
      setLoadingProgress(prev => ({ ...prev, combined: true }));
      const combinedData = await fetchPaginatedData(API_BASE_URL, searchTerm, 'combined', 1, 10);
      setAllData(prev => ({ ...prev, combined: { ...combinedData, currentPage: 1 } }));
      setLoadingProgress(prev => ({ ...prev, combined: false }));

      let activeItem = null;

      // Set initial selected result as soon as we have some data
      if (combinedData.results.length > 0 && !selectedResult) {
        const firstResult = combinedData.results[0];
        activeItem = firstResult;
        setSelectedResult({ 
          ...firstResult, 
          system: 'Combined', 
          type: 'combined',
          termName: firstResult.title || searchTerm
        });
      } else if (mapping && !selectedResult) {
        activeItem = mapping;
        setSelectedResult({ 
          ...mapping, 
          system: systemType || 'Combined', 
          type: 'mapping',
          termName: mapping.source_term?.english_name || mapping.title || searchTerm
        });
      } else if (item && !selectedResult) {
        activeItem = item;
        setSelectedResult({
          ...item,
          system: systemType || 'System',
          type: 'item',
          termName: item.english_name || item.title || searchTerm
        });
      }

      if (!activeItem && selectedResult) {
        activeItem = selectedResult;
      }

      // Load other systems in parallel but update state individually
      const systems = ['ayurveda', 'unani', 'siddha', 'icd11'];
      
      systems.forEach(async (system) => {
        setLoadingProgress(prev => ({ ...prev, [system]: true }));
        const systemData = await fetchPaginatedData(API_BASE_URL, searchTerm, system, 1, 10);
        
        // If direct search yields no results for traditional medicine, try to use mapping data
        if (systemData.results.length === 0 && system !== 'icd11') {
          let mappedTerm = null;
          if (activeItem) {
            if (activeItem[`related_${system}`]) {
              mappedTerm = activeItem[`related_${system}`];
            } else if (activeItem.namaste_terms && activeItem.namaste_terms[system]) {
              mappedTerm = activeItem.namaste_terms[system];
            }
          }
          if (mappedTerm) {
            // Ensure the mapped term has an id for rendering keys
            systemData.results = [{...mappedTerm, id: mappedTerm.id || Math.random().toString()}];
            systemData.count = 1;
          }
        }
        
        setAllData(prev => ({ 
          ...prev, 
          [system]: { 
            ...systemData, 
            currentPage: 1 
          } 
        }));
        setLoadingProgress(prev => ({ ...prev, [system]: false }));
      });

      setIsLoading(false);
    };

    loadDataProgressively();
  }, [searchTerm, mapping, item, systemType]);

  // Pagination functions
  const getCurrentPageData = (data) => {
    if (!data?.results?.length) return [];
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.results.slice(startIndex, endIndex);
  };

  const getTotalPages = (data) => {
    if (!data?.results?.length) return 0;
    return Math.ceil(data.results.length / itemsPerPage);
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPagination = (data, systemKey) => {
    const totalPages = getTotalPages(data);
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="pagination">
        <button 
          className="pagination-btn"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
        >
          First
        </button>
        
        <button 
          className="pagination-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        
        {startPage > 1 && (
          <span className="pagination-ellipsis">...</span>
        )}
        
        {pageNumbers.map(number => (
          <button
            key={number}
            className={`pagination-btn ${currentPage === number ? 'active' : ''}`}
            onClick={() => handlePageChange(number)}
          >
            {number}
          </button>
        ))}
        
        {endPage < totalPages && (
          <span className="pagination-ellipsis">...</span>
        )}
        
        <button 
          className="pagination-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
        
        <button 
          className="pagination-btn"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          Last
        </button>
        
        <span className="pagination-info">
          Page {currentPage} of {totalPages} ({data.results.length} total items)
        </span>
        
        {data.next && currentPage === Math.ceil(data.results.length / itemsPerPage) && (
          <button 
            className="pagination-btn load-more-btn"
            onClick={() => loadMoreResults(systemKey)}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    );
  };

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Fetch detailed data for a specific term - optimized with caching and pagination
  const fetchDetailedData = useCallback(async (termName) => {
    if (!termName || loadedTermsRef.current.has(termName)) return;
    
    setIsLoading(true);
    loadedTermsRef.current.add(termName);
    
    try {
      // Fetch first page of each system quickly
      const [combinedDetail, ayurvedaDetail, unaniDetail, siddhaDetail, icd11Detail] = await Promise.all([
        fetchPaginatedData(API_BASE_URL, termName, 'combined', 1, 10),
        fetchPaginatedData(API_BASE_URL, termName, 'ayurveda', 1, 10),
        fetchPaginatedData(API_BASE_URL, termName, 'unani', 1, 10),
        fetchPaginatedData(API_BASE_URL, termName, 'siddha', 1, 10),
        fetchPaginatedData(API_BASE_URL, termName, 'icd11', 1, 10)
      ]);

      setDetailedData({
        combined: combinedDetail,
        ayurveda: ayurvedaDetail,
        unani: unaniDetail,
        siddha: siddhaDetail,
        icd11: icd11Detail
      });

      // Fetch additional pages in the background for systems with more results
      const fetchAdditionalPages = async () => {
        const systems = [
          { name: 'combined', data: combinedDetail },
          { name: 'ayurveda', data: ayurvedaDetail },
          { name: 'unani', data: unaniDetail },
          { name: 'siddha', data: siddhaDetail },
          { name: 'icd11', data: icd11Detail }
        ];

        for (const system of systems) {
          if (system.data.next) {
            const allData = await fetchAllPagesForSystem(API_BASE_URL, termName, system.name);
            setDetailedData(prev => ({
              ...prev,
              [system.name]: { ...prev[system.name], ...allData }
            }));
          }
        }
      };

      // Don't await this - let it run in background
      fetchAdditionalPages();
      
    } catch (error) {
      console.error("Error fetching detailed data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  const handleResultClick = async (result, systemName, type = 'system') => {
    const termName = result.english_name || result.title || result.name || result.source_term?.english_name;
    const newSelectedResult = { 
      ...result, 
      system: systemName, 
      type, 
      termName,
      definition: result.definition
    };
    
    setSelectedResult(newSelectedResult);
    setActiveTab('detailed-view');
    
    // Fetch detailed data
    await fetchDetailedData(termName);
  };

  // Helper function to render system results with loading states
  const renderSystemResults = (systemData, systemName) => {
    const isCurrentlyLoading = loadingProgress[systemName.toLowerCase()];
    const systemKey = systemName.toLowerCase();

    if (isCurrentlyLoading) {
      return (
        <div className="loading-section">
          <div className="spinner"></div>
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

    const currentData = getCurrentPageData(systemData);
    const totalPages = getTotalPages(systemData);

    return (
      <div className="system-results">
        <div className="results-summary">
          <h4>Found {systemData.count} results in {systemName}</h4>
          <p>Showing {Math.min(itemsPerPage, currentData.length)} of {systemData.results.length} results (Page {currentPage} of {totalPages})</p>
        </div>
        
        <div className="results-table-container">
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
                {systemName === 'Combined' && <th>Definition</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((result, index) => (
                <motion.tr 
                  key={result.id || index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="result-row"
                >
                  <td>{result.code || "N/A"}</td>
                  <td>{result.english_name || result.title || "N/A"}</td>
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
                  {systemName === 'Combined' && (
                    <td className="definition-cell">
                      {result.definition ? `${result.definition.substring(0, 100)}${result.definition.length > 100 ? '...' : ''}` : "-"}
                    </td>
                  )}
                  <td>
                    <button 
                      className="view-details-btn"
                      onClick={() => handleResultClick(result, systemName)}
                    >
                      View Details
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {renderPagination(systemData, systemKey)}
        </div>
      </div>
    );
  };

  const renderCombinedResults = () => {
    const isCurrentlyLoading = loadingProgress.combined;

    if (isCurrentlyLoading) {
      return (
        <div className="loading-section">
          <div className="spinner"></div>
          <p>Loading combined search data...</p>
        </div>
      );
    }

    if (!allData?.combined?.results?.length) {
      return (
        <div className="no-results">
          <p>No combined search data available.</p>
        </div>
      );
    }

    const currentResults = getCurrentPageData(allData.combined);

    return (
      <div className="combined-results">
        <h3>ICD-11 Terms with Traditional Medicine Mappings</h3>
        {currentResults.map((result, index) => (
          <div key={index} className="combined-card detailed">
            <div className="combined-header">
              <h4>{result.title}</h4>
              <div className="combined-meta">
                <span className="code-badge">Code: {result.code}</span>
                {result.search_score && (
                  <span className="score-badge">
                    Search Score: {(result.search_score * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            
            <div className="combined-content">
              <div className="icd-section">
                <h5>ICD-11 Details</h5>
                <div className="definition-section">
                  <strong>Definition:</strong>
                  <p>{result.definition || "No definition available"}</p>
                </div>
                <div className="icd-meta">
                  <span><strong>Class Kind:</strong> {result.class_kind || "N/A"}</span>
                  <span><strong>Foundation URI:</strong> {result.foundation_uri ? 
                    <a href={result.foundation_uri} target="_blank" rel="noopener noreferrer">View</a> : "N/A"}</span>
                </div>
              </div>

              <div className="mappings-section">
                <h5>Traditional Medicine Mappings</h5>
                <div className="mapping-grid">
                  {['ayurveda', 'siddha', 'unani'].map(system => (
                    <div key={system} className="mapping-item">
                      <h6>{system.charAt(0).toUpperCase() + system.slice(1)}</h6>
                      {result[`related_${system}`] ? (
                        <div className="mapping-details">
                          <p><strong>Code:</strong> {result[`related_${system}`].code}</p>
                          <p><strong>Name:</strong> {result[`related_${system}`].english_name}</p>
                          {result[`related_${system}`].local_name && (
                            <p><strong>Local Name:</strong> {result[`related_${system}`].local_name}</p>
                          )}
                        </div>
                      ) : (
                        <p className="no-mapping">No mapping available</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {result.mapping_info && (
                <div className="mapping-info-section">
                  <h5>Mapping Information</h5>
                  <div className="mapping-info-grid">
                    <span><strong>Confidence:</strong> {(result.mapping_info.confidence_score * 100).toFixed(1)}%</span>
                    <span><strong>Source System:</strong> {result.mapping_info.source_system}</span>
                    {result.mapping_info.icd_similarity && (
                      <span><strong>ICD Similarity:</strong> {(result.mapping_info.icd_similarity * 100).toFixed(1)}%</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              className="view-full-details-btn"
              onClick={() => handleResultClick(result, 'Combined', 'combined')}
            >
              View Full Details
            </button>
          </div>
        ))}
        {renderPagination(allData.combined, 'combined')}
      </div>
    );
  };

  // Find best matching result from detailed data
  const findBestMatch = (data, termName) => {
    if (!data?.results?.length) return null;
    
    const termNameLower = termName.toLowerCase();
    
    // Try exact match first
    let match = data.results.find(result => {
      const resultName = (result.english_name || result.title || '').toLowerCase();
      return resultName === termNameLower;
    });
    
    // Try partial match
    if (!match) {
      match = data.results.find(result => {
        const resultName = (result.english_name || result.title || '').toLowerCase();
        return resultName.includes(termNameLower) || termNameLower.includes(resultName);
      });
    }
    
    // Return first result as fallback
    return match || data.results[0];
  };

  const renderDetailedView = () => {
    if (!selectedResult) {
      return (
        <div className="no-selection">
          <h3>Select a result to view details</h3>
          <p>Click on any result from the tabs above to view detailed information.</p>
        </div>
      );
    }

    const result = selectedResult;
    const termName = result.termName || result.english_name || result.title || result.name || result.source_term?.english_name;
    
    // Get best matches from detailed data or fall back to allData or mapping data
    const getMatchData = (system) => {
      // 1. If we have mapping data passed directly in the selectedResult, use it!
      if (system !== 'combined' && system !== 'icd11') {
        const sysKey = system.toLowerCase();
        
        // If it came from the SearchPage mappingResults table:
        if (result.type === 'mapping' && result.namaste_terms && result.namaste_terms[sysKey]) {
          return result.namaste_terms[sysKey];
        }
        
        // If it came from the Combined tab inside MappingDetailsPage:
        if (result[`related_${sysKey}`]) {
          return result[`related_${sysKey}`];
        }
      }

      // 2. Otherwise try detailedData (which now contains all pages)
      if (detailedData && detailedData[system]?.results?.length) {
        return findBestMatch(detailedData[system], termName);
      }
      // 3. Fall back to initial search data
      return findBestMatch(allData[system], termName);
    };

    const combinedMatch = getMatchData('combined');
    const ayurvedaMatch = getMatchData('ayurveda');
    const unaniMatch = getMatchData('unani');
    const siddhaMatch = getMatchData('siddha');
    const icd11Match = getMatchData('icd11');

    return (
      <div className="detailed-view">
        <div className="detail-header">
          <div className="header-main">
            <h3>{termName}</h3>
            <div className="detail-meta">
              <span className="system-tag">{result.system}</span>
              <span className="code-tag">{result.code || result.source_term?.code || 'N/A'}</span>
              {result.confidence_score && (
                <span className="confidence-tag">
                  {(result.confidence_score * 100).toFixed(1)}% Confidence
                </span>
              )}
              {result.search_score && (
                <span className="score-tag">
                  {(result.search_score * 100).toFixed(1)}% Search Score
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-content">
          {/* ICD-11/Combined Details */}
          <div className="detail-section">
            <h4>ICD-11 Details</h4>
            {combinedMatch ? (
              <div className="system-details-grid">
                <div className="detail-item">
                  <label>CODE</label>
                  <span className="highlight-code">{combinedMatch.code || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>TITLE</label>
                  <span>{combinedMatch.title || 'N/A'}</span>
                </div>
                <div className="detail-item full-width">
                  <label>DEFINITION</label>
                  <div className="definition-content">
                    {combinedMatch.definition || 'No definition available'}
                  </div>
                </div>
                <div className="detail-item">
                  <label>CLASS KIND</label>
                  <span>{combinedMatch.class_kind || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>FOUNDATION URI</label>
                  <span className="uri-link">
                    {combinedMatch.foundation_uri ? 
                      <a href={combinedMatch.foundation_uri} target="_blank" rel="noopener noreferrer">
                        View in ICD-11 Browser
                      </a> : 'N/A'
                    }
                  </span>
                </div>
                {combinedMatch.search_score && (
                  <div className="detail-item">
                    <label>SEARCH SCORE</label>
                    <span className="score-value">{(combinedMatch.search_score * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-data-available">
                <p>No ICD-11 data available for "{termName}"</p>
              </div>
            )}
          </div>

          {/* Ayurveda Details */}
          <div className="detail-section">
            <h4>Ayurveda Details</h4>
            {ayurvedaMatch ? (
              <div className="system-details-grid">
                <div className="detail-item">
                  <label>CODE</label>
                  <span className="highlight-code">{ayurvedaMatch.code || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>ENGLISH NAME</label>
                  <span>{ayurvedaMatch.english_name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>HINDI NAME</label>
                  <span>{ayurvedaMatch.hindi_name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>DIACRITICAL NAME</label>
                  <span>{ayurvedaMatch.diacritical_name || 'N/A'}</span>
                </div>
                {ayurvedaMatch.id && (
                  <div className="detail-item">
                    <label>TERM ID</label>
                    <span>{ayurvedaMatch.id}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-data-available">
                <p>No Ayurveda data available for "{termName}"</p>
              </div>
            )}
          </div>

          {/* Unani Details */}
          <div className="detail-section">
            <h4>Unani Details</h4>
            {unaniMatch ? (
              <div className="system-details-grid">
                <div className="detail-item">
                  <label>CODE</label>
                  <span className="highlight-code">{unaniMatch.code || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>ENGLISH NAME</label>
                  <span>{unaniMatch.english_name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>ARABIC NAME</label>
                  <span>{unaniMatch.arabic_name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>ROMANIZED NAME</label>
                  <span>{unaniMatch.romanized_name || 'N/A'}</span>
                </div>
                {unaniMatch.id && (
                  <div className="detail-item">
                    <label>TERM ID</label>
                    <span>{unaniMatch.id}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-data-available">
                <p>No Unani data available for "{termName}"</p>
              </div>
            )}
          </div>

          {/* Siddha Details */}
          <div className="detail-section">
            <h4>Siddha Details</h4>
            {siddhaMatch ? (
              <div className="system-details-grid">
                <div className="detail-item">
                  <label>CODE</label>
                  <span className="highlight-code">{siddhaMatch.code || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>ENGLISH NAME</label>
                  <span>{siddhaMatch.english_name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>TAMIL NAME</label>
                  <span>{siddhaMatch.tamil_name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>ROMANIZED NAME</label>
                  <span>{siddhaMatch.romanized_name || 'N/A'}</span>
                </div>
                {siddhaMatch.id && (
                  <div className="detail-item">
                    <label>TERM ID</label>
                    <span>{siddhaMatch.id}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-data-available">
                <p>No Siddha data available for "{termName}"</p>
              </div>
            )}
          </div>

          {/* ICD-11 Details (separate from combined) */}
          <div className="detail-section">
            <h4>ICD-11 Direct Search Results</h4>
            {icd11Match ? (
              <div className="system-details-grid">
                <div className="detail-item">
                  <label>CODE</label>
                  <span className="highlight-code icd-code">{icd11Match.code || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>TITLE</label>
                  <span>{icd11Match.title || 'N/A'}</span>
                </div>
                <div className="detail-item full-width">
                  <label>DEFINITION</label>
                  <div className="definition-content">
                    {icd11Match.definition || 'No definition available'}
                  </div>
                </div>
                <div className="detail-item">
                  <label>FOUNDATION URI</label>
                  <span className="uri-link">
                    {icd11Match.foundation_uri ? 
                      <a href={icd11Match.foundation_uri} target="_blank" rel="noopener noreferrer">
                        View
                      </a> : 'N/A'
                    }
                  </span>
                </div>
                <div className="detail-item">
                  <label>CLASS KIND</label>
                  <span>{icd11Match.class_kind || 'N/A'}</span>
                </div>
              </div>
            ) : (
              <div className="no-data-available">
                <p>No ICD-11 direct search data available for "{termName}"</p>
              </div>
            )}
          </div>

          {/* Mapping Details (if available) */}
          {result.type === 'mapping' && result.mapping_info && (
            <div className="detail-section">
              <h4>Mapping Information</h4>
              <div className="mapping-details-grid">
                <div className="detail-item">
                  <label>MAPPING ID</label>
                  <span>{result.mapping_info.id || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>CONFIDENCE SCORE</label>
                  <span className="confidence-value">
                    {(result.mapping_info.confidence_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="detail-item">
                  <label>SOURCE SYSTEM</label>
                  <span>{result.mapping_info.source_system || searchParams?.system || 'ICD-11'}</span>
                </div>
                {result.mapping_info.icd_similarity && (
                  <div className="detail-item">
                    <label>ICD SIMILARITY</label>
                    <span className="similarity-value">
                      {(result.mapping_info.icd_similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading && !allData.combined.results.length) {
    return (
      <div className="mapping-details-page">
        <div className="container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading detailed information for "{searchTerm}"...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!searchTerm) {
    return (
      <div className="mapping-details-page">
        <div className="container">
          <div className="error-state">
            <h2>No Term Specified</h2>
            <p>Please go back and select a specific term to view details.</p>
            <Link to="/search" className="back-btn">Back to Search</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mapping-details-page">
      <div className="container">
        <header className="page-header">
          <button onClick={() => navigate(-1)} className="back-btn">← Back to Results</button>
        </header>

        <motion.div
          className="page-header-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="page-title">{searchTerm}</h1>
          <p className="search-context">Comprehensive medical terminology search results across all systems</p>
        </motion.div>

        <div className="tab-navigation">
          {['overview', 'combined', 'ayurveda', 'unani', 'siddha', 'icd11', 'detailed-view'].map((tab) => (
            <button 
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              {loadingProgress[tab] && <span className="loading-dot"></span>}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === "overview" && (
            <motion.div className="overview-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2>Search Results Overview</h2>
              <div className="overview-cards">
                {[
                  { name: 'Combined', data: allData.combined, color: '#2196F3', key: 'combined' },
                  { name: 'Ayurveda', data: allData.ayurveda, color: '#4CAF50', key: 'ayurveda' },
                  { name: 'Unani', data: allData.unani, color: '#FF9800', key: 'unani' },
                  { name: 'Siddha', data: allData.siddha, color: '#9C27B0', key: 'siddha' },
                  { name: 'ICD-11', data: allData.icd11, color: '#F44336', key: 'icd11' }
                ].map((system) => (
                  <div 
                    key={system.name} 
                    className="overview-card" 
                    onClick={() => setActiveTab(system.key)}
                  >
                    <div className="card-icon" style={{ backgroundColor: system.color }}>
                      {system.name.charAt(0)}
                      {loadingProgress[system.key] && <div className="card-loading"></div>}
                    </div>
                    <h3>{system.name}</h3>
                    <div className="count">
                      {loadingProgress[system.key] ? (
                        <div className="spinner-small"></div>
                      ) : (
                        system.data.count
                      )}
                    </div>
                    <p>Results Found</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "combined" && (
            <motion.div className="combined-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2>Combined Search Results</h2>
              {renderCombinedResults()}
            </motion.div>
          )}

          {activeTab === "ayurveda" && (
            <motion.div className="system-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2>Ayurveda Results</h2>
              {renderSystemResults(allData.ayurveda, 'Ayurveda')}
            </motion.div>
          )}

          {activeTab === "unani" && (
            <motion.div className="system-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2>Unani Results</h2>
              {renderSystemResults(allData.unani, 'Unani')}
            </motion.div>
          )}

          {activeTab === "siddha" && (
            <motion.div className="system-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2>Siddha Results</h2>
              {renderSystemResults(allData.siddha, 'Siddha')}
            </motion.div>
          )}

          {activeTab === "icd11" && (
            <motion.div className="system-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2>ICD-11 Results</h2>
              {renderSystemResults(allData.icd11, 'ICD-11')}
            </motion.div>
          )}

          {activeTab === "detailed-view" && (
            <motion.div className="detailed-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {renderDetailedView()}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MappingDetailsPage;