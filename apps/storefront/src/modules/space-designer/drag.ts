/**
 * Drag payload for dropping a catalogue product onto the 3D floor. It lives in
 * its own module so the panel can read it without pulling in the three.js
 * bundle that `space-scene` loads dynamically.
 */
export const SPACE_PRODUCT_MIME = 'application/x-space-product';
