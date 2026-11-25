
// lib/hdidido/types.ts
export type BookingType = "competition" | "casual";

export type BookingMember = {
  full_name: string;
  club_id?: string;
  hdidido_email?: string;
};

export type BookingRequest = {
  requester_email: string;
  booking_type: BookingType;
  club_name?: string;
  target_date: string; // YYYY-MM-DD
  target_time: string; // HH:mm (club local time)
  time_window_secs?: number; // e.g., +/- 45s around target
  members: BookingMember[];
  run_at: string; // ISO timestamp
  notes?: string;

  // Optional encrypted credentials just for this run (if you don’t use SSO)
  // Use encryptJson({ username, password }) with ENCRYPTION_KEY
  enc_credentials_b64?: string;

  // System fields
  status?: "queued" | "in_progress" | "success" | "failed";
  attempts?: number;
  created_at?: string;
};

export type BookingRun = {
  request_id: string;
  started_at: string;
  finished_at?: string;
  outcome?: "success" | "failed";
  error?: string;
  evidence?: {
    confirmation_text?: string;
    tee_time?: string;
    screenshot_b64?: string; // keep brief or omit; we can upload later if needed
  };
};
