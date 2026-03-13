# Heuristic UX Audit — Card Maker

Use this checklist to walk through the app systematically. For each item, mark **Pass**, **Fail**, or **Partial**, add notes, and rate severity (1 = cosmetic, 2 = minor, 3 = major, 4 = critical).

**Time estimate:** 30–45 minutes  
**Setup:** Open https://maxfrost1308.github.io/card-maker/ in Chrome (desktop). Have a sample CSV ready.

---

## H1 — Visibility of System Status

The system should keep users informed about what's going on through timely feedback.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 1.1 | When a CSV is uploading/parsing, is there a loading indicator? | | | |
| 1.2 | After CSV upload, does the app confirm how many cards were loaded? | | | |
| 1.3 | When saving (Ctrl+S / Save button), is there visible feedback (e.g., "Saved" toast)? | | | |
| 1.4 | When exporting a deck or PNG, does the user see progress or confirmation? | | | |
| 1.5 | Does the selected card type show clearly which type is active? | | | |
| 1.6 | In Table view, is it clear how many rows are shown vs. filtered out? | | | |
| 1.7 | When editing a card, is it clear which card (number/name) is being edited? | | | |
| 1.8 | Is the current view (Cards vs. Table) clearly indicated as active? | | | |
| 1.9 | When bulk edit is applied, is there confirmation of how many cards were updated? | | | |

---

## H2 — Match Between System and the Real World

Use language and concepts familiar to the user, not system-oriented jargon.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 2.1 | Are field names in the card type schema human-readable (not camelCase/snake_case)? | | | |
| 2.2 | Is the term "card type" clear, or would "template" be more intuitive? | | | |
| 2.3 | Is "Open CSV" clear to non-technical users, or should it say "Open spreadsheet"? | | | |
| 2.4 | Does "Export deck (.cardmaker)" explain what the format is for? | | | |
| 2.5 | Are icons (✎, ⊕, ☰, 🌙) recognizable without tooltips? | | | |
| 2.6 | Is the "Overlay" toggle's purpose clear without explanation? | | | |

---

## H3 — User Control and Freedom

Users need a clear "emergency exit" to leave unwanted states.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 3.1 | Can the user undo a card deletion? | | | |
| 3.2 | Does "Cancel" in the edit modal discard unsaved changes reliably? | | | |
| 3.3 | Can the user undo a bulk edit? | | | |
| 3.4 | If the user accidentally uploads the wrong CSV, can they go back easily? | | | |
| 3.5 | Can the edit modal be closed via X, Escape key, and backdrop click? | | | |
| 3.6 | After printing, can the user return to the editor without losing data? | | | |
| 3.7 | Does the browser back button behave sensibly (not break the app)? | | | |

---

## H4 — Consistency and Standards

Follow platform conventions; don't make users wonder whether different words/actions mean the same thing.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 4.1 | Is the Save shortcut (Ctrl+S) discoverable (shown in a tooltip or label)? | | | |
| 4.2 | Do all buttons use a consistent style (filled, outlined, icon-only)? | | | |
| 4.3 | Is the edit icon consistent across Cards view and Table view? | | | |
| 4.4 | Does "Save" always mean "write to file" and never "close modal"? (Are Save and Apply distinct?) | | | |
| 4.5 | Are confirmation patterns consistent (e.g., always a toast, or always inline)? | | | |
| 4.6 | Does dark mode apply uniformly (no unstyled areas or jarring color switches)? | | | |
| 4.7 | Is the sidebar layout consistent between different card types? | | | |

---

## H5 — Error Prevention

Prevent errors before they happen.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 5.1 | Does the app warn before overwriting unsaved changes (e.g., uploading a new CSV)? | | | |
| 5.2 | If a CSV has columns that don't match the selected card type, is there a clear warning? | | | |
| 5.3 | Does bulk edit show a confirmation before applying changes? | | | |
| 5.4 | Is the delete-card action guarded by a confirmation prompt? | | | |
| 5.5 | Can the user preview the print layout before sending to the printer? | | | |
| 5.6 | If uploading a custom card type with invalid JSON, is the error clear and specific? | | | |

---

## H6 — Recognition Rather Than Recall

Minimize memory load; make objects, actions, and options visible.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 6.1 | Is the field reference always visible when editing a card? | | | |
| 6.2 | Does the edit modal show field labels (not just empty inputs)? | | | |
| 6.3 | In Table view, are column headers always visible (sticky header)? | | | |
| 6.4 | Is the currently selected card type shown somewhere persistent (not just the dropdown)? | | | |
| 6.5 | Can the user see the card preview update live while editing in the modal? | | | |
| 6.6 | Are keyboard shortcuts listed somewhere accessible (help menu, footer, tooltip)? | | | |

---

## H7 — Flexibility and Efficiency of Use

Accelerators for expert users that don't encumber beginners.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 7.1 | Does Ctrl+S save reliably as an accelerator? | | | |
| 7.2 | Can users navigate between cards in the edit modal with keyboard arrows? | | | |
| 7.3 | Does the Table view support inline editing (click-to-edit cells)? | | | |
| 7.4 | Can power users drag-and-drop a CSV onto the app to load it? | | | |
| 7.5 | Does the tag autocomplete work efficiently (responsive, accurate suggestions)? | | | |
| 7.6 | Can multiple cards be selected and edited together (bulk select flow)? | | | |

---

## H8 — Aesthetic and Minimalist Design

Don't show information that is irrelevant or rarely needed.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 8.1 | Is the sidebar overwhelming, or is it well-organized with clear sections? | | | |
| 8.2 | Are the card previews clean and readable, or cluttered with chrome? | | | |
| 8.3 | In the edit modal, are only relevant fields shown (no empty/useless sections)? | | | |
| 8.4 | Is the Export menu appropriately hidden behind a dropdown (not cluttering the toolbar)? | | | |
| 8.5 | Does the empty state provide enough guidance without being verbose? | | | |
| 8.6 | Is spacing consistent across components (cards, modal, table, sidebar)? | | | |

---

## H9 — Help Users Recognize, Diagnose, and Recover from Errors

Error messages should be in plain language, indicate the problem, and suggest a solution.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 9.1 | If CSV parsing fails, is the error message human-readable (not a stack trace)? | | | |
| 9.2 | If a required field is missing in a card, is the issue highlighted visually? | | | |
| 9.3 | If custom card type JSON is malformed, does the error point to the problem? | | | |
| 9.4 | If File System Access API is unavailable, does the app explain the fallback? | | | |
| 9.5 | If the browser doesn't support a required feature, is there a helpful message? | | | |

---

## H10 — Help and Documentation

Provide help that's easy to search, focused on the task, and concise.

| #   | Check | Pass/Fail | Severity | Notes |
|-----|-------|-----------|----------|-------|
| 10.1 | Is the "Download sample CSV" link easy to find for first-time users? | | | |
| 10.2 | Is there any in-app guidance for creating custom card types? | | | |
| 10.3 | Does the field reference panel explain what each field does? | | | |
| 10.4 | Is there a help link or onboarding flow for brand-new users? | | | |
| 10.5 | Is the template syntax (Mustache-like) documented somewhere accessible from the app? | | | |

---

## Summary

| Heuristic | Pass | Fail | Partial | Top Issue |
|-----------|------|------|---------|-----------|
| H1 Visibility of System Status | | | | |
| H2 Match to Real World | | | | |
| H3 User Control & Freedom | | | | |
| H4 Consistency & Standards | | | | |
| H5 Error Prevention | | | | |
| H6 Recognition Over Recall | | | | |
| H7 Flexibility & Efficiency | | | | |
| H8 Aesthetic & Minimalist Design | | | | |
| H9 Error Recovery | | | | |
| H10 Help & Documentation | | | | |

**Overall Rating:** ___ / 5  
**Top 3 Issues to Fix First:**
1.
2.
3.
