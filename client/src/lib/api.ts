const envApiUrl = import.meta.env.VITE_API_URL;
const API_BASE = envApiUrl ? `${envApiUrl.replace(/\/$/, '')}/api/v1` : '/api/v1';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('srusti_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
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
  const res = await fetch(url, {
    ...options,
    headers,
  });

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
