# App-wide layout hierarchy

## Goal
Replace the repeated card-on-card structure across all ten signed-in screens with a consistent hierarchy: one visually weighted primary action, lighter borderless sections for secondary content, compact cards only for short important records, and divided rows for long/simple lists. Existing behavior, navigation, and color tokens remain unchanged.

## Changes
- Add a shared `Section` component with a heading, optional right-aligned action, and borderless content area.
- Keep the dashboard greeting and stat row intact; make mood history and quick links lighter, denser sections.
- Keep the Symptoms and Medical Profile tabs, while restructuring their internal forms, summaries, timelines, and record lists.
- Give each action form a single Card with a subtle existing-token header band.
- Convert secondary regions such as timelines, adherence, reminders, trend history, authorized doctors, prep questions, and community experiences to borderless Sections.
- Keep compact cards only for meaningful short records such as medications, allergies, conditions, lab results, care-team members, guidance outcomes, and triage results.
- Use divided rows for chronological/simple lists such as symptom history, wellbeing entries, appointment questions, and community stories.
- Remove repeated or near-duplicate titles below each page header.

## Verification
- Run the project TypeScript check.
- Confirm the latest preview build has no errors.
- Open Dashboard, Symptoms, and Medications at desktop and mobile widths, capture screenshots, and review whether the new hierarchy clearly eliminates repetitive card stacking and avoids overlap.
- Confirm those pages produce no browser console errors.

## Technical notes
- `src/styles.css` will not be modified.
- Data queries, mutations, authentication, safety copy, and route behavior will stay unchanged.
