import { apiFetch } from '../client';
import type { RawRecommendation } from '../../normalize/recommendations';

export interface GetRecommendationsParams {
  limit?: number;
  excludeId?: number;
}

export interface GetRecommendationsResponse {
  recommendations: RawRecommendation[];
}

export function getRecommendations(
  params: GetRecommendationsParams = {},
): Promise<GetRecommendationsResponse> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.excludeId != null) query.set('excludeId', String(params.excludeId));
  const queryString = query.toString();
  return apiFetch(`/recommendations${queryString ? `?${queryString}` : ''}`);
}
