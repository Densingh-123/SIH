// Central API configuration
// All components should import API_BASE from this file
// To change the backend URL, update REACT_APP_API_BASE in the .env file

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

export default API_BASE;
