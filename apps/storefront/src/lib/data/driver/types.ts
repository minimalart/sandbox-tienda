// ============================================================================
// Driver PWA — tipos compartidos
// ============================================================================

export type DeliveryExecutionStatus =
  | "pending"
  | "pickup"
  | "in_transit"
  | "delivered"
  | "failed_attempt";

export type DeliveryAction =
  | "pickup"
  | "in_transit"
  | "delivered"
  | "failed_attempt";

export interface DeliveryAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface DeliveryExecution {
  id: string;
  status: DeliveryExecutionStatus;
  order_display_id?: string | number;
  order_id?: string;
  tracking_number?: string;
  address?: DeliveryAddress;
  customer_name?: string;
  customer_phone?: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionLocation {
  lat: number;
  lng: number;
}

// ── Proof of Delivery ─────────────────────────────────────────────────────────

export type ProofOfDeliveryType = "photo" | "signature" | "geo";

export interface ProofOfDelivery {
  type: ProofOfDeliveryType;
  /** URL devuelta por POST /store/delivery/driver/uploads (para tipo 'photo') */
  file_url?: string;
  /** URL devuelta por POST /store/delivery/driver/uploads (para tipo 'signature') */
  signature_url?: string;
  lat?: number;
  lng?: number;
  note?: string;
}

export interface UploadProofResponse {
  url: string;
  id: string;
}

export interface ExecutionActionPayload {
  action: DeliveryAction;
  location?: ActionLocation;
  note?: string;
  proof?: ProofOfDelivery;
}

export interface DriverMeStopsResponse {
  executions: DeliveryExecution[];
}

export interface ExecutionActionResponse {
  execution: DeliveryExecution;
}
