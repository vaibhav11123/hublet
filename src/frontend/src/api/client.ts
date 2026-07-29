import axios from 'axios';

// Reads from .env / Vercel environment variables at build time.
// Set VITE_API_BASE_URL=https://project-monorepo-team-46.onrender.com/api for production.
// Set VITE_API_BASE_URL=http://localhost:3000/api for local development.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
const AUTH_TOKEN_KEY = 'hublet_auth_token';
const AUTH_USER_KEY = 'hublet_auth_user';

function readStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

const initialToken = readStoredToken();
if (initialToken) {
    api.defaults.headers.common.Authorization = `Bearer ${initialToken}`;
    axios.defaults.headers.common.Authorization = `Bearer ${initialToken}`;
}

api.interceptors.request.use((config) => {
    const token = readStoredToken();
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export function setAuthSession(token: string, user: any) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function clearAuthSession() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
    delete api.defaults.headers.common.Authorization;
    delete axios.defaults.headers.common.Authorization;
}

export function getAuthSession(): { token: string | null; user: any | null } {
    if (typeof window === 'undefined') {
        return { token: null, user: null };
    }
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
    let user = null;
    if (rawUser) {
        try {
            user = JSON.parse(rawUser);
        } catch {
            user = null;
        }
    }
    return { token, user };
}

// Auth
export const authApi = {
    adminLogin: (data: { email: string; password: string }) => api.post('/auth/admin/login', data),
    buyerSignup: (data: any) => api.post('/auth/buyer/signup', data),
    buyerLogin: (data: { email: string; password: string }) => api.post('/auth/buyer/login', data),
    sellerSignup: (data: any) => api.post('/auth/seller/signup', data),
    sellerLogin: (data: { email: string; password: string }) => api.post('/auth/seller/login', data),
};

// Buyers
export const buyerApi = {
    create: (data: any) => api.post('/buyers', data),
    getAll: () => api.get('/buyers'),
    getById: (id: string) => api.get(`/buyers/${id}`),
    update: (id: string, data: any) => api.put(`/buyers/${id}`, data),
    delete: (id: string) => api.delete(`/buyers/${id}`),
};

// Sellers
export const sellerApi = {
    create: (data: any) => api.post('/sellers', data),
    getAll: () => api.get('/sellers'),
    getById: (id: string) => api.get(`/sellers/${id}`),
    update: (id: string, data: any) => api.put(`/sellers/${id}`, data),
    delete: (id: string) => api.delete(`/sellers/${id}`),
};

// Properties
export const propertyApi = {
    create: (data: any) => api.post('/properties', data),
    getAll: (params?: any) => api.get('/properties', { params }),
    getById: (id: string) => api.get(`/properties/${id}`),
    update: (id: string, data: any) => api.put(`/properties/${id}`, data),
    delete: (id: string) => api.delete(`/properties/${id}`),
    getForMap: (params?: any) => api.get('/properties/map', { params }),
    reverseGeocode: (lat: number, lon: number) =>
        api.get('/properties/reverse-geocode', { params: { lat, lon } }),
    getNearbyPlaces: (lat: number, lon: number, signal?: AbortSignal) =>
        api.get('/properties/nearby-places', { params: { lat, lon }, signal }),
};

// Matching
export const matchingApi = {
    findForBuyer: (buyerId: string, params?: any) =>
        api.post(`/matches/buyer/${buyerId}/find`, null, { params }),
    findForProperty: (propertyId: string, params?: any) =>
        api.post(`/matches/property/${propertyId}/find`, null, { params }),
    getForBuyer: (buyerId: string) => api.get(`/matches/buyer/${buyerId}`),
    getForProperty: (propertyId: string) => api.get(`/matches/property/${propertyId}`),
};

// Leads
export const leadApi = {
    create: (data: any) => api.post('/leads', data),
    getAll: (params?: any) => api.get('/leads', { params }),
    getById: (id: string) => api.get(`/leads/${id}`),
    transition: (id: string, toState: string) =>
        api.post(`/leads/${id}/transition`, { toState }),
    getAllowedStates: (id: string) => api.get(`/leads/${id}/allowed-states`),
};

export default api;
