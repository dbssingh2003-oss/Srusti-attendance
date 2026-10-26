const envApiUrl = import.meta.env.VITE_API_URL;
const API_BASE = envApiUrl ? `${envApiUrl.replace(/\/$/, '')}/api/v1` : '/api/v1';

interface CustomRequestInit extends RequestInit {
  _retry?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function onTokenRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: CustomRequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('srusti_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let url: string;
  if (endpoint.startsWith('http')) {
    url = endpoint;
  } else if (endpoint.startsWith('/api/v1')) {
    url = envApiUrl ? `${envApiUrl.replace(/\/$/, '')}${endpoint}` : endpoint;
  } else {
    url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new Error(netErr?.message || 'Network request failed. Please check your connection.');
  }

  const isAuthEndpoint =
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/register') ||
    endpoint.includes('/auth/refresh') ||
    endpoint.includes('/auth/logout');

  // Handle 401 Unauthorized with automatic token refresh
  if (res.status === 401 && !options._retry && !isAuthEndpoint) {
    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        subscribeTokenRefresh((newToken: string | null) => {
          if (!newToken) {
            reject(new Error('Session expired. Please log in again.'));
            return;
          }
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${newToken}`,
          };
          resolve(
            apiRequest<T>(endpoint, {
              ...options,
              headers: retryHeaders,
              _retry: true,
            })
          );
        });
      });
    }

    options._retry = true;
    isRefreshing = true;

    try {
      const refreshUrl = `${API_BASE}/auth/refresh`;
      const savedRefreshToken = localStorage.getItem('srusti_refresh');
      const refreshRes = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: savedRefreshToken ? JSON.stringify({ refreshToken: savedRefreshToken }) : undefined,
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newAccessToken = refreshData.accessToken;
        if (newAccessToken) {
          localStorage.setItem('srusti_token', newAccessToken);
          if (refreshData.refreshToken) {
            localStorage.setItem('srusti_refresh', refreshData.refreshToken);
          }
          isRefreshing = false;
          onTokenRefreshed(newAccessToken);

          headers['Authorization'] = `Bearer ${newAccessToken}`;
          return apiRequest<T>(endpoint, {
            ...options,
            headers,
            _retry: true,
          });
        }
      }

      throw new Error('Refresh failed');
    } catch {
      isRefreshing = false;
      onTokenRefreshed(null);
      localStorage.removeItem('srusti_token');
      localStorage.removeItem('srusti_refresh');
      localStorage.removeItem('srusti_user');
      window.dispatchEvent(new CustomEvent('srusti_logout'));
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (res.status === 204) {
    return {} as T;
  }

  let data: any = {};
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    const rawText = await res.text().catch(() => '');
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { message: rawText };
      }
    }
  }

  if (!res.ok) {
    const errorMsg =
      data?.error?.message ||
      data?.message ||
      (res.status === 500
        ? 'Internal Server Error (500). Please check backend server logs or database connectivity.'
        : `Request failed with status ${res.status}`);
    throw new Error(errorMsg);
  }

  return data as T;
}
