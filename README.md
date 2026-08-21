# Health Companion App

Build "AI Health Companion — Patient App": a complete, production-ready React + TypeScript + Vite + Tailwind CSS web app (shadcn/ui components on top of Tailwind is fine). This is the patient-facing half of a two-app health system; a separate doctor dashboard will be built next and shares the same backend. Work efficiently and prioritize finishing every screen fully functional over polish — this must compile and deploy cleanly in this single pass.

CONNECT TO THIS EXISTING SUPABASE PROJECT (do not provision a new Lovable-managed database — this is the only backend, already fully built with tables, RLS, and an edge function):
- Project URL: https://hmrdsqgbyoysmfdhmlkw.supabase.co
- Publishable/anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcmRzcWdieW95c21mZGhtbGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MzY1NzcsImV4cCI6MjEwMjUxMjU3N30.5zmw0C3wd6vgqYvxydf75ywjvS7X_6VnQFOv2Pk_ouc
Install @supabase/supabase-js, create a typed client, and query tables directly with the anon key — RLS already restricts patients to their own rows, so no service key is ever needed client-side.

RELEVANT SCHEMA (already live — do not modify): patients(id, full_name, date_of_birth) — id equals the authenticated user's auth id. medical_history(id, patient_id, condition_name, icd10_code, status[active|resolved|chronic], diagnosed_date, notes). allergies(id, patient_id, allergen, reaction, severity[mild|moderate|severe|life_threatening]). medications(id, patient_id, drug_name, dosage, frequency, start_date, end_date, active). symptoms(id, patient_id, description, body_location, onset_date, severity 1-10, source[patient_logged|photo_triage|conversational_extraction]). lab_results(id, patient_id, test_name, value, unit, reference_range, ingestion_path[manual|photo_ocr|fhir], reviewed_and_corrected). differential_diagnoses(id, patient_id, rank, condition_name, icd10_code, probability_score, confidence_tier[well_established|moderate|rare_contested], urgency[emergency|same_day|scheduled_visit|monitor], disclosed_to_patient, doctor_confirmed). doctor_patient_links(id, patient_id, doctor_id, status[active|revoked], authorized_at). doctors(id, full_name). community_content(id, title, source_ref, excerpt, lived_experience_label). wellbeing_checkins(id, patient_id, mood_rating 1-10, notes, created_at). crisis_escalations(id, patient_id, severity, status). appointment_prep_questions(id, patient_id, question, based_on_symptom_id).

AUTH: Supabase email/password. On sign-up call supabase.auth.signUp with options.data = { role: 'patient', full_name }. A DB trigger auto-creates the matching `patients` row — never insert into `patients` manually. Build one polished auth screen (sign-in/sign-up toggle, inline validation, loading + error states) and a protected route wrapper redirecting unauthenticated users to it.

BUILD ALL OF THESE AS REAL, FULLY WORKING SCREENS AGAINST THE LIVE DATABASE (no mock/placeholder data anywhere once connected):

1. Dashboard (home): greeting with patient's name, stat cards (active meds count, recent symptoms count, pending prep questions count), a small mood trend chart from the last 14 wellbeing_checkins, quick links to every screen below.

2. Symptom Organizer: guided form (description, body_location, severity slider 1-10, onset_date) inserting into `symptoms`; chronological timeline of all logged symptoms; a "Pre-visit summary" view compiling recent symptoms + active meds + allergies into a clean printable card (window.print is fine).

3. Medication Companion: CRUD list of `medications` (add/edit/deactivate); a simple 7-day adherence check-off grid (local state, pragmatic — no dedicated adherence table exists); a side-effect report form that inserts into `symptoms` referencing the medication name in the description.

4. Photo-Based Triage: photo upload (file input, webcam optional) plus short description, inserting into `symptoms` with source='photo_triage'. CRITICAL SAFETY RULE: after submit, show ONLY one of exactly two non-diagnostic outcome cards — "Worth a doctor's look" or "Common, monitor" — never a condition name, never a diagnosis.

5. Guidance / Disclosure Gate: list the patient's `differential_diagnoses`. CRITICAL SAFETY RULE: only ever show `condition_name` and `confidence_tier` when `disclosed_to_patient = true`. When false, show ONLY the `urgency` translated to plain guidance text ("See a doctor today" / "Schedule a visit soon" / "Keep monitoring") — never the name, never the raw probability_score. Persistent banner: "This is guidance, not a diagnosis."

6. Wellbeing Check-In: daily mood (1-10) + notes form inserting into `wellbeing_checkins`, trend chart of past entries. If mood_rating <= 3, show a calm, supportive (not alarming) crisis-support panel and insert a `crisis_escalations` row with severity scaled to the rating.

7. Community: card grid from `community_content` (title, excerpt, link to source_ref); every card visibly labeled "Lived experience — not medical advice".

8. Care Team / Doctor Hand-off: form to enter a doctor's ID and authorize (insert `doctor_patient_links`, status='active'); list of authorized doctors (join `doctors` for full_name) with a Revoke button (sets status='revoked').

9. Appointment Prep: list `appointment_prep_questions`, checkbox to mark done (local state ok), a "Generate more" button that inserts a couple of templated questions tied to the most recent symptom.

10. Medical Profile: full CRUD for `medical_history`, `allergies`, and `lab_results` (manual entry; support a photo-upload path for labs that sets ingestion_path='photo_ocr', reviewed_and_corrected=false until the patient confirms/edits the parsed value, then flips true).

DESIGN: Real, trustworthy, ready-to-ship health product — calm modern healthcare palette (soft teals/blues, warm neutrals), rounded cards, clear hierarchy, fully responsive with sidebar on desktop and bottom nav on mobile, loading skeletons, empty states, toast notifications on every mutation. Wire all 10 screens into the nav. Zero console errors, zero dead links, genuinely deployable when done — this is the top priority, finish every screen rather than polishing fewer of them.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e5c5749b-7434-4b92-aa42-a09c84bb8a06).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
