import {
  EventItem,
  EventGuest,
  CheckinRequest,
  CheckinResponse,
  CheckinLog,
  EmailTemplate,
  CheckinStats,
  SmtpConfig,
  Role,
  User,
} from '../types/index.js';

const API_BASE = '/api';

// Every call goes through this: an expired session (401) tells the app to show the login screen.
// Shadows the global fetch inside this module on purpose.
const fetch = async (input: string, init?: RequestInit): Promise<Response> => {
  const res = await window.fetch(input, init);
  if (res.status === 401 && !input.endsWith('/auth/login') && !input.endsWith('/auth/me')) {
    window.dispatchEvent(new Event('auth:expired'));
  }
  return res;
};

async function call<T = any>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export interface OfflineCheckinItem {
  id: string;
  request: CheckinRequest;
  timestamp: string;
}

export const api = {
  // 0. Auth & accounts
  async login(email: string, password: string): Promise<User> {
    return (await call('/auth/login', 'POST', { email, password })).data;
  },

  async logout(): Promise<void> {
    await call('/auth/logout', 'POST').catch(() => {});
  },

  async me(): Promise<User | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/me`);
      if (!res.ok) return null;
      return (await res.json()).data;
    } catch {
      return null;
    }
  },

  async changePassword(current_password: string, new_password: string): Promise<void> {
    await call('/auth/change-password', 'POST', { current_password, new_password });
  },

  async listUsers(): Promise<User[]> {
    return (await call('/users', 'GET')).data;
  },

  async createUser(data: { name: string; email: string; password: string; role: Role }): Promise<User> {
    return (await call('/users', 'POST', data)).data;
  },

  async updateUser(
    id: string,
    patch: { name?: string; role?: Role; active?: boolean; password?: string }
  ): Promise<User> {
    return (await call(`/users/${id}`, 'PATCH', patch)).data;
  },

  // 1. Events
  async getEvents(): Promise<EventItem[]> {
    try {
      const res = await fetch(`${API_BASE}/events`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  async createEvent(data: Partial<EventItem>): Promise<EventItem> {
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  // 2. Guests
  async getEventGuests(
    eventId: string,
    params?: {
      search?: string;
      org?: string;
      invitation_status?: string;
      checkin_status?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    data: EventGuest[];
    pagination: { total: number; page: number; limit: number; total_pages: number };
    filter_options: { organizations: string[] };
  }> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.org) q.set('org', params.org);
    if (params?.invitation_status) q.set('invitation_status', params.invitation_status);
    if (params?.checkin_status) q.set('checkin_status', params.checkin_status);
    if (params?.page) q.set('page', params.page.toString());
    if (params?.limit) q.set('limit', params.limit.toString());

    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/guests?${q.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json;
    } catch {
      return {
        data: [],
        pagination: { total: 0, page: 1, limit: params?.limit || 25, total_pages: 1 },
        filter_options: { organizations: [] },
      };
    }
  },

  async createGuest(eventId: string, data: any): Promise<EventGuest> {
    const res = await fetch(`${API_BASE}/events/${eventId}/guests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async updateGuest(eventGuestId: string, data: any): Promise<EventGuest> {
    const res = await fetch(`${API_BASE}/event-guests/${eventGuestId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async deleteGuest(eventGuestId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/event-guests/${eventGuestId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },


  async importGuests(eventId: string, rows: any[]): Promise<any> {
    const res = await fetch(`${API_BASE}/events/${eventId}/guests/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    return res.json();
  },

  // 3. Invitations
  async sendInvitation(eventGuestId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/event-guests/${eventGuestId}/send`, {
      method: 'POST',
    });
    return res.json();
  },

  async sendBulkInvitations(eventId: string, guestIds: string[]): Promise<any> {
    const res = await fetch(`${API_BASE}/events/${eventId}/send-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestIds }),
    });
    return res.json();
  },

  async sendAllPending(eventId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/events/${eventId}/send-all-pending`, {
      method: 'POST',
    });
    return res.json();
  },

  async getEmailTemplate(eventId: string): Promise<EmailTemplate> {
    const res = await fetch(`${API_BASE}/events/${eventId}/email-template`);
    const json = await res.json();
    return json.data;
  },

  async updateEmailTemplate(eventId: string, tpl: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const res = await fetch(`${API_BASE}/events/${eventId}/email-template`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tpl),
    });
    const json = await res.json();
    return json.data;
  },

  // SMTP Settings & Test
  async getSmtpConfig(): Promise<SmtpConfig> {
    const res = await fetch(`${API_BASE}/smtp-config`);
    const json = await res.json();
    return json.data;
  },

  async updateSmtpConfig(config: Partial<SmtpConfig>): Promise<any> {
    const res = await fetch(`${API_BASE}/smtp-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async verifySmtp(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/smtp-config/verify`, {
      method: 'POST',
    });
    return res.json();
  },

  async sendTestEmail(email: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/smtp-config/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  async getPublicTicket(code: string): Promise<any> {
    const res = await fetch(`${API_BASE}/ticket/${encodeURIComponent(code)}`);
    return res.json();
  },

  // 4. Checkin
  async checkin(req: CheckinRequest): Promise<CheckinResponse> {
    try {
      const res = await fetch(`${API_BASE}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (res.status === 401) {
        // session expired mid-event: keep the scan, it syncs after the next login
        this.enqueueOfflineCheckin(req);
        return {
          success: false,
          status: 'ERROR',
          message: 'Phiên đăng nhập đã hết hạn. Lượt quét đã được lưu và sẽ đồng bộ sau khi đăng nhập lại.',
        };
      }
      return await res.json();
    } catch (err: any) {
      // Offline fallback: store in offline queue
      this.enqueueOfflineCheckin(req);
      return {
        success: false,
        status: 'ERROR',
        message: 'Mất kết nối mạng! Lượt quét đã được lưu vào hàng đợi offline và sẽ tự động đồng bộ khi có mạng.',
      };
    }
  },

  async resetCheckin(params: { eventId?: string; eventGuestId?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/checkin/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  // 5. Stats & Logs
  async getStats(eventId: string): Promise<CheckinStats> {
    const defaultStats: CheckinStats = {
      total_guests: 0,
      checked_in_count: 0,
      not_checked_in_count: 0,
      checkin_percentage: 0,
      invited_count: 0,
      pending_invitation_count: 0,
      invitation_percentage: 0,
      organization_breakdown: [],
      recent_checkins_hourly: [],
    };
    if (!eventId) return defaultStats;
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/stats`);
      if (!res.ok) return defaultStats;
      const json = await res.json();
      return json.data || defaultStats;
    } catch {
      return defaultStats;
    }
  },

  async getLogs(
    eventId: string,
    filters?: { result?: string; search?: string; limit?: number }
  ): Promise<CheckinLog[]> {
    if (!eventId) return [];
    try {
      const q = new URLSearchParams();
      if (filters?.result) q.set('result', filters.result);
      if (filters?.search) q.set('search', filters.search);
      if (filters?.limit) q.set('limit', filters.limit.toString());

      const res = await fetch(`${API_BASE}/events/${eventId}/checkins?${q.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  // Offline Queue
  getOfflineQueue(): OfflineCheckinItem[] {
    try {
      const raw = localStorage.getItem('offline_checkin_queue');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  enqueueOfflineCheckin(request: CheckinRequest) {
    try {
      const queue = this.getOfflineQueue();
      queue.push({
        id: 'off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        request,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('offline_checkin_queue', JSON.stringify(queue));
    } catch {}
  },

  async syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const remaining: OfflineCheckinItem[] = [];

    for (const item of queue) {
      try {
        const res = await fetch(`${API_BASE}/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.request),
        });
        if (res.ok) {
          synced++;
        } else {
          remaining.push(item);
          failed++;
        }
      } catch {
        remaining.push(item);
        failed++;
      }
    }

    localStorage.setItem('offline_checkin_queue', JSON.stringify(remaining));
    return { synced, failed };
  },
};
