import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const authToken = token || localStorage.getItem('srusti_token');

  const targetUrl = import.meta.env.VITE_SOCKET_URL || '/';

  if (!socket && authToken) {
    socket = io(targetUrl, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 4000,
    });
  } else if (socket && authToken && socket.auth && (socket.auth as any).token !== authToken) {
    socket.disconnect();
    socket = io(targetUrl, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 4000,
    });
  }

  return socket!;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
