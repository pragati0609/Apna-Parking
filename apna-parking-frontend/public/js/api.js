/**
 * APNA PARKING - Unified API & Authentication Client Module
 * Connects Frontend seamlessly with the Flask REST API & JWT Engine
 */

const API_BASE = (window.location.origin.startsWith('http')) 
  ? '/api' 
  : 'http://127.0.0.1:5000/api';

const ApnaAPI = {
  API_BASE,

  // Token & Session Storage
  getToken() {
    return localStorage.getItem('apna_auth_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('apna_auth_token', token);
    } else {
      localStorage.removeItem('apna_auth_token');
    }
  },

  getUser() {
    try {
      const u = localStorage.getItem('apna_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('apna_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('apna_user');
    }
  },

  clearAuth() {
    localStorage.removeItem('apna_auth_token');
    localStorage.removeItem('apna_user');
    window.dispatchEvent(new CustomEvent('apna:auth_change', { detail: { isAuthenticated: false, user: null } }));
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  // Centralized Request Wrapper with Automatic Authorization Headers
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = Object.assign({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }, options.headers || {});

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });

      if (res.status === 401 && token) {
        // Token has expired or is revoked
        console.warn('Authentication token expired or invalid. Clearing session.');
        this.clearAuth();
        window.dispatchEvent(new CustomEvent('apna:unauthorized', { detail: { endpoint } }));
      }

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMsg = (data && (data.error || data.message)) || `HTTP Error ${res.status}`;
        return { success: false, status: res.status, error: errorMsg, message: errorMsg, data };
      }

      if (data && typeof data === 'object' && !('success' in data)) {
        data.success = true;
      }
      return data;
    } catch (err) {
      console.error(`Network error requesting ${url}:`, err);
      return { success: false, error: err.message, message: 'Could not connect to server. Please check your connection.' };
    }
  },

  // -------------------------------------------------------------------------
  // Authentication Endpoints
  // -------------------------------------------------------------------------

  async signup(userData) {
    const res = await this.request('/signup', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    return res;
  },

  async login(credentials) {
    const res = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res && res.access_token) {
      this.setToken(res.access_token);
      if (res.user) this.setUser(res.user);
      window.dispatchEvent(new CustomEvent('apna:auth_change', { 
        detail: { isAuthenticated: true, user: res.user } 
      }));
    }
    return res;
  },

  async getProfile() {
    return await this.request('/profile');
  },

  async logout() {
    try {
      await this.request('/logout', { method: 'POST' });
    } finally {
      this.clearAuth();
    }
    return { success: true, message: 'Logged out successfully' };
  },

  // -------------------------------------------------------------------------
  // Parking Spots & Search Endpoints
  // -------------------------------------------------------------------------

  async getParkingSpots(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/parking-spots${query ? '?' + query : ''}`);
  },

  async getNearbySpots(lat, lng, vehicleType = 'all', radius = 30) {
    const query = new URLSearchParams({
      lat: lat || '',
      lng: lng || '',
      vehicleType,
      radius
    }).toString();
    return await this.request(`/parking-spots/nearby?${query}`);
  },

  async getSpotById(id) {
    return await this.request(`/parking-spots/${id}`);
  },

  // -------------------------------------------------------------------------
  // Bookings & Passes Endpoints
  // -------------------------------------------------------------------------

  async createBooking(bookingData) {
    return await this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  },

  async getBookings() {
    return await this.request('/bookings');
  },

  async cancelBooking(id) {
    return await this.request(`/bookings/${id}/cancel`, { method: 'POST' });
  },

  async extendBooking(id, extraHours = 1) {
    return await this.request(`/bookings/${id}/extend`, {
      method: 'POST',
      body: JSON.stringify({ extraHours })
    });
  },

  // -------------------------------------------------------------------------
  // Payments & Razorpay Endpoints
  // -------------------------------------------------------------------------

  async createPaymentOrder(bookingId) {
    return await this.request('/payments/create', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId })
    });
  },

  async verifyPayment(paymentPayload) {
    return await this.request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify(paymentPayload)
    });
  },

  async getPaymentHistory(page = 1, perPage = 10) {
    return await this.request(`/payments/history?page=${page}&per_page=${perPage}`);
  },

  // -------------------------------------------------------------------------
  // Leads & Stats
  // -------------------------------------------------------------------------

  async submitPartnerInquiry(data) {
    return await this.request('/contact', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getPlatformStats() {
    return await this.request('/stats');
  }
};

window.ApnaAPI = ApnaAPI;
