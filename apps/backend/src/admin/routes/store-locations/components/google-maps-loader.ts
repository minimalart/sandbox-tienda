/**
 * Shared Google Maps JS loader for the store-locations admin components
 * (LocationPicker + PolygonPicker). Injects the script once with the libraries
 * both need (`places` for search/geocoding, `geometry` for helpers). The
 * `drawing` library is intentionally NOT loaded — DrawingManager was removed in
 * Maps JS API v3.65; coverage polygons come from GeoJSON upload instead.
 * Reads VITE_GOOGLE_MAPS_API_KEY.
 */

export const getGoogleMapsApiKey = (): string => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
};

let scriptPromise: Promise<void> | null = null;

export const loadGoogleMaps = (apiKey: string): Promise<void> => {
  const w = window as unknown as {
    google?: { maps?: { places?: unknown } };
    __slGoogleMapsCallback?: () => void;
    gm_authFailure?: () => void;
  };

  if (w.google?.maps?.places) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise<void>((resolve, reject) => {
    w.__slGoogleMapsCallback = () => resolve();
    w.gm_authFailure = () => {
      scriptPromise = null;
      reject(new Error('Google Maps API authentication failed'));
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=places,geometry&v=weekly&loading=async&callback=__slGoogleMapsCallback`;
    script.async = true;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};
