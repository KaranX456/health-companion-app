import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://hmrdsqgbyoysmfdhmlkw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcmRzcWdieW95c21mZGhtbGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MzY1NzcsImV4cCI6MjEwMjUxMjU3N30.5zmw0C3wd6vgqYvxydf75ywjvS7X_6VnQFOv2Pk_ouc";

const isBrowser = typeof window !== "undefined";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    storage: isBrowser ? window.localStorage : undefined,
  },
});

/* ---- Row types (schema is fixed and managed elsewhere) ---- */
export type Patient = { id: string; full_name: string | null; date_of_birth: string | null };
export type MedicalHistory = {
  id: string;
  patient_id: string;
  condition_name: string;
  icd10_code: string | null;
  status: "active" | "resolved" | "chronic";
  diagnosed_date: string | null;
  notes: string | null;
};
export type Allergy = {
  id: string;
  patient_id: string;
  allergen: string;
  reaction: string | null;
  severity: "mild" | "moderate" | "severe" | "life_threatening";
};
export type Medication = {
  id: string;
  patient_id: string;
  drug_name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
};
export type Symptom = {
  id: string;
  patient_id: string;
  description: string;
  body_location: string | null;
  onset_date: string | null;
  severity: number | null;
  source: "patient_logged" | "photo_triage" | "conversational_extraction";
  created_at?: string | null;
};
export type LabResult = {
  id: string;
  patient_id: string;
  test_name: string;
  value: string | null;
  unit: string | null;
  reference_range: string | null;
  ingestion_path: "manual" | "photo_ocr" | "fhir";
  reviewed_and_corrected: boolean;
};
export type DifferentialDiagnosis = {
  id: string;
  patient_id: string;
  rank: number | null;
  condition_name: string | null;
  icd10_code: string | null;
  probability_score: number | null;
  confidence_tier: "well_established" | "moderate" | "rare_contested" | null;
  urgency: "emergency" | "same_day" | "scheduled_visit" | "monitor";
  disclosed_to_patient: boolean;
  doctor_confirmed: boolean;
};
export type DoctorLink = {
  id: string;
  patient_id: string;
  doctor_id: string;
  status: "active" | "revoked";
  authorized_at: string | null;
  doctors?: { full_name: string | null } | null;
};
export type CommunityContent = {
  id: string;
  title: string;
  source_ref: string | null;
  excerpt: string | null;
  lived_experience_label: string | null;
};
export type WellbeingCheckin = {
  id: string;
  patient_id: string;
  mood_rating: number;
  notes: string | null;
  created_at: string;
};
export type PrepQuestion = {
  id: string;
  patient_id: string;
  question: string;
  based_on_symptom_id: string | null;
};