import {
  BootstrapData,
  Court,
  Coach,
  Equipment,
  Booking,
  User,
  PriceCalculation,
  AdminStats,
} from '../types';

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  try {
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (metaTag?.content) {
      csrfToken = metaTag.content;
      return csrfToken;
    }
    let res = await fetch('/csrf-token', { credentials: 'include' });
    if (!res.ok) {
      res = await fetch('/auth/csrf-token', { credentials: 'include' });
    }
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.data?.csrf_token || data.csrf_token || '';
      return csrfToken || '';
    }
  } catch (err) {
    console.warn('Failed to fetch CSRF token:', err);
  }
  return '';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await fetchCsrfToken();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE')) {
    headers.set('X-CSRFToken', token);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  let payload: any = null;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    const errMsg = payload?.message || payload?.error || `Request failed with status ${response.status}`;
    throw new Error(errMsg);
  }

  return payload as T;
}

export const api = {
  // Auth
  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await request<{ success: boolean; data: User }>('/me');
      return res.data || null;
    } catch {
      return null;
    }
  },

  async login(username: string, password: string): Promise<User> {
    const res = await request<{ success: boolean; data: User; message?: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return res.data;
  },

  async signup(username: string, email: string, password: string): Promise<User> {
    const res = await request<{ success: boolean; data: User; message?: string }>('/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    return res.data;
  },

  async logout(): Promise<void> {
    await request('/logout', { method: 'GET' });
  },

  async demoLogin(role: 'admin' | 'user'): Promise<User> {
    const res = await request<{ success: boolean; data: User; message?: string }>('/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    return res.data;
  },

  // Customer Booking Hub
  async getBootstrap(dateStr: string): Promise<BootstrapData> {
    return request<BootstrapData>(`/api/v1/bootstrap?date=${encodeURIComponent(dateStr)}`);
  },

  async getAvailability(dateStr: string, timeSlot: string, duration: number): Promise<any> {
    return request(`/api/v1/availability?date=${dateStr}&time_slot=${timeSlot}&duration=${duration}`);
  },

  async calculatePrice(params: {
    court_id: number;
    date: string;
    time_slot: string;
    duration: number;
    coach_id?: number | null;
    equipment_requests?: Record<number, number>;
    equipment?: Record<number, number>;
  }): Promise<PriceCalculation> {
    const eq = params.equipment || params.equipment_requests || {};
    const res = await request<{ success: boolean; data: PriceCalculation }>('/api/v1/calculate-price', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        equipment: eq,
        equipment_requests: eq,
      }),
    });
    return res.data || (res as any);
  },

  async createBooking(payload: {
    court_id: number;
    date: string;
    time_slot: string;
    duration: number;
    coach_id?: number | null;
    equipment_requests?: Record<number, number>;
    equipment?: Record<number, number>;
    client_timezone?: string;
  }): Promise<any> {
    const eq = payload.equipment || payload.equipment_requests || {};
    const tz = payload.client_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return request('/api/v1/bookings', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        equipment: eq,
        equipment_requests: eq,
        client_timezone: tz,
      }),
    });
  },

  async getUserBookings(): Promise<Booking[]> {
    const res = await request<{ success: boolean; data?: Booking[] } | Booking[]>('/api/v1/bookings');
    if (Array.isArray(res)) return res;
    return (res as any).data || [];
  },

  async cancelBooking(bookingId: number): Promise<any> {
    return request(`/api/v1/bookings/${bookingId}/cancel`, {
      method: 'POST',
    });
  },

  // Admin Console Endpoints
  async getAdminStats(): Promise<AdminStats> {
    const res = await request<AdminStats>('/api/v1/admin/stats');
    return res;
  },

  async getAdminCourts(): Promise<Court[]> {
    return request<Court[]>('/api/v1/admin/courts');
  },

  async createAdminCourt(data: { name: string; type: string; basePrice: number; isActive: boolean }): Promise<Court> {
    const res = await request<{ success: boolean; data: Court }>('/api/v1/admin/courts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async updateAdminCourt(courtId: number, data: Partial<Court>): Promise<any> {
    return request(`/api/v1/admin/courts/${courtId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminCourt(courtId: number): Promise<any> {
    return request(`/api/v1/admin/courts/${courtId}`, {
      method: 'DELETE',
    });
  },

  async getAdminEquipment(): Promise<Equipment[]> {
    return request<Equipment[]>('/api/v1/admin/equipment');
  },

  async createAdminEquipment(data: { name: string; price: number; totalAvailable: number; isActive: boolean }): Promise<Equipment> {
    const res = await request<{ success: boolean; data: Equipment }>('/api/v1/admin/equipment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async updateAdminEquipment(id: number, data: Partial<Equipment>): Promise<any> {
    return request(`/api/v1/admin/equipment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminEquipment(id: number): Promise<any> {
    return request(`/api/v1/admin/equipment/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminCoaches(): Promise<Coach[]> {
    return request<Coach[]>('/api/v1/admin/coaches');
  },

  async createAdminCoach(data: { name: string; price: number; specialization: string; isActive: boolean }): Promise<Coach> {
    const res = await request<{ success: boolean; data: Coach }>('/api/v1/admin/coaches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async updateAdminCoach(id: number, data: Partial<Coach>): Promise<any> {
    return request(`/api/v1/admin/coaches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminCoach(id: number): Promise<any> {
    return request(`/api/v1/admin/coaches/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminPricingRules(): Promise<any> {
    return request('/api/v1/admin/pricing-rules');
  },

  async updateAdminPricingRules(rules: any[]): Promise<any> {
    return request('/api/v1/admin/pricing-rules', {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    });
  },

  async getAdminRevenueReport(): Promise<any> {
    return request('/api/v1/admin/reports/revenue');
  },

  async getAdminBookings(): Promise<Booking[]> {
    const res = await request<any>('/api/v1/admin/bookings');
    if (Array.isArray(res)) return res;
    return res.data || res.bookings || [];
  },
};
