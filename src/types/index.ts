export interface Plan {
  id: string;
  name: string;
  rate_limit_per_min: number;
  monthly_quota: number;
  price_per_1k_req: number;
}

export interface ApiKey {
  id: string;
  org_id: string;
  key_hash: string;
  hint: string;
  status: 'active' | 'revoked' | 'expired';
  plan_id: string;
  plans?: Plan;
}

export interface UsageLog {
  id?: string;
  key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  latency_ms: number;
}

export type Variables = {
  apiKeyInfo: ApiKey;
};
