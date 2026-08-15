import { apiFetch } from '../client';

export interface ConversationSummary {
  handle: string;
  displayName: string;
  lastMessage: { body: string; at: string; fromMe: boolean };
  unreadCount: number;
}

export interface Message {
  id: number;
  body: string;
  createdAt: string;
  fromMe: boolean;
}

export function getConversations(signal?: AbortSignal): Promise<{
  conversations: ConversationSummary[];
}> {
  return apiFetch('/messages', { signal });
}

export function getConversation(
  handle: string,
  signal?: AbortSignal,
): Promise<{ messages: Message[]; total: number; page: number; pageSize: number }> {
  return apiFetch(`/messages/${encodeURIComponent(handle)}`, { signal });
}

// 403 NOT_MUTUAL_FAVORITE and 422 MESSAGE_REJECTED are distinct on purpose:
// one is fixed by favouriting someone back, the other by editing the words.
export function postMessage(handle: string, body: string): Promise<{ message: Message }> {
  return apiFetch(`/messages/${encodeURIComponent(handle)}`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function markConversationRead(handle: string): Promise<{ marked: number }> {
  return apiFetch(`/messages/${encodeURIComponent(handle)}/read`, { method: 'POST' });
}

/** Polled by the header badge, so it never raises the global loading bar. */
export function getUnreadCount(signal?: AbortSignal): Promise<{ count: number }> {
  return apiFetch('/messages/unread-count', { signal, silent: true });
}
