export interface AiInterpretationBannerProps {
  interpretation: string | null;
}

/**
 * Seam for a future catalog-aware AI search endpoint. POST /api/ai/search
 * doesn't return an `interpretation` field today and its results carry no
 * catalog id/slug to route to, so `interpretation` is always null for now
 * (see LOS-78 plan notes). Renders nothing until that's resolved.
 */
export function AiInterpretationBanner({ interpretation }: AiInterpretationBannerProps) {
  if (!interpretation) return null;
  return <p>{interpretation}</p>;
}
