import { apiFetch } from '../client';

export function getHealth(): Promise<{ status: string }> {
  return apiFetch('/health');
}
