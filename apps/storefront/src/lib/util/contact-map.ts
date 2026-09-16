export const buildGoogleMapsEmbedUrl = (address: string): string =>
  `https://www.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`
