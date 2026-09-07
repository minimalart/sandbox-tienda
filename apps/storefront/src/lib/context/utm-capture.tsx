"use client";

import { useUtm } from "@lib/hooks/use-utm";

export default function UtmCapture() {
  useUtm();
  return null;
}
