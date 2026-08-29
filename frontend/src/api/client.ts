import axios from 'axios';

// API Base URL - default to localhost:8000 for backend
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

// Default operator identity (used when no auth system is present)
export const OPERATOR_ID = import.meta.env.VITE_OPERATOR_ID || 'Operator_Demo';
export const OPERATOR_ROLE = 'OPERATOR';
export const SUPERVISOR_ROLE = 'SUPERVISOR';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add a mock "Operator" role since there's no real auth yet
apiClient.interceptors.request.use((config) => {
  // If the endpoint supports query params for roles/requested_by, we could append them here,
  // or add a custom header. For now, we will add a custom header.
  config.headers['X-Operator-Id'] = OPERATOR_ID;
  return config;
});

