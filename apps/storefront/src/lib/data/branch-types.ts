// Types for branch resolution. Kept out of `branch.ts` because that file is a
// "use server" module, which may only export async functions.

export interface ResolvedBranch {
  id: string;
  name: string;
  street?: string;
  city?: string;
  province?: string;
  lat?: string | null;
  lng?: string | null;
}

export interface BranchResolution {
  covered: boolean;
  branch: ResolvedBranch | null;
  sales_channel_id: string | null;
  coverage_id?: string;
  match_type?: string;
  delivery?: {
    lead_time_hours: number | null;
    timezone: string | null;
    schedules: unknown;
  } | null;
}
