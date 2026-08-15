import { apiFetch } from '../client';

// Matches PUT /users/me (LOS-251). Every field is optional and an absent one is
// left alone, so a page that changes one thing sends one thing. 400 names the
// offending `field`; 409 carries code HANDLE_TAKEN, the same answer
// registration gives.
export interface UpdateMeRequest {
  displayName?: string;
  handle?: string;
  isDiscoverable?: boolean;
}

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  handle: string;
  isDiscoverable: boolean;
}

export function updateMe(body: UpdateMeRequest): Promise<{ user: UserProfile }> {
  return apiFetch('/users/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
