import { API_URL } from './config';

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const { store } = require('../store/store');
  const token = store.getState().auth.token;
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!headers['Content-Type'] && options.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
  }

  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.substring(4) : endpoint;
  const url = cleanEndpoint.startsWith('http') ? cleanEndpoint : `${API_URL}${cleanEndpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
};
