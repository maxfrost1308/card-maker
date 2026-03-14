# Accessibility Audit — Card Maker

This checklist covers what automated tools (axe-core) **cannot** reliably catch. Use it alongside the automated `05-accessibility.spec.js` tests.

**Time estimate:** 20–30 minutes  
**Tools needed:** Keyboard only, screen reader (VoiceOver/NVDA), browser DevTools  
**Test URL:** https://maxfrost1308.github.io/card-maker/

---

## A. Keyboard Navigation

Test the entire app without touching the mouse.

| #   | Check | Pass/Fail | Notes |
|-----|-------|-----------|-------|
| A.1 | Can you Tab through all interactive elements in a logical order? | | |
| A.2 | Is the focus indicator visible on every focused element (no invisible focus)? | | |
| A.3 | Can you open and navigate the card type dropdown with keyboard only? | | |
| A.4 | Can you trigger "Open CSV" and select a file with keyboard? | | |
| A.5 | Can you open the edit modal, edit a field, and save — all by keyboard? | | |
| A.6 | When the edit modal opens, does focus move into it? | | |
| A.7 | When the edit modal closes, does focus return to the element that opened it? | | |
| A.8 | Is focus trapped inside the edit modal (Tab doesn't escape to background)? | | |
| A.9 | Can you close the modal with Escape? | | |
| A.10 | Can you navigate the ← → arrows in the edit modal via keyboard? | | |
| A.11 | Can you switch between Cards and Table view with keyboard? | | |
| A.12 | In Table view, can you navigate cells and edit inline with keyboard? | | |
| A.13 | Can you use the Export dropdown menu with keyboard (Enter to open, arrows to navigate, Enter to select, Escape to close)? | | |
| A.14 | Can you interact with the tag autocomplete using keyboard (type, arrow through suggestions, Enter to select)? | | |
| A.15 | Does the "Skip to main content" link work and focus the card grid? | | |
| A.16 | Can you select and deselect cards for bulk edit using keyboard? | | |
| A.17 | Does the dark mode toggle work with Enter/Space? | | |

---

## B. Screen Reader Experience

Test with VoiceOver (macOS) or NVDA (Windows). Focus on whether the app is _understandable_ without visuals.

| #   | Check | Pass/Fail | Notes |
|-----|-------|-----------|-------|
| B.1 | Is the page title announced when the app loads? | | |
| B.2 | Are landmark regions defined (main, nav, aside, banner)? | | |
| B.3 | Does the sidebar announce as a navigation or aside region? | | |
| B.4 | Is the card type dropdown labeled (not just "select")? | | |
| B.5 | When cards load, is the card grid announced (role, number of items)? | | |
| B.6 | Does each card have a name/label announced by the screen reader? | | |
| B.7 | Is the edit modal announced as a dialog with a title? | | |
| B.8 | Are form fields inside the edit modal properly labeled? | | |
| B.9 | Are pill pickers (tags, dropdowns) announced with their current value? | | |
| B.10 | Is the Table view announced as a data table with headers? | | |
| B.11 | When filtering in Table view, are result count changes announced (live region)? | | |
| B.12 | Is the "X selected" count in bulk edit announced dynamically? | | |
| B.13 | Are status messages (save confirmation, error messages) announced as live regions? | | |
| B.14 | Are icon-only buttons (✎, ⊕, ☰, 🌙) announced with meaningful labels? | | |
| B.15 | Is the overlay toggle purpose announced by a screen reader? | | |

---

## C. Visual & Color

| #   | Check | Pass/Fail | Notes |
|-----|-------|-----------|-------|
| C.1 | Does the app work at 200% browser zoom without content being cut off or overlapping? | | |
| C.2 | Does the app work at 400% zoom (WCAG 2.1 AA reflow requirement)? | | |
| C.3 | In dark mode, do all text elements maintain sufficient contrast (4.5:1 for normal, 3:1 for large)? | | |
| C.4 | In light mode, do all text elements maintain sufficient contrast? | | |
| C.5 | Are there any color-only indicators (e.g., rarity colors on TTRPG cards) without a text/icon alternative? | | |
| C.6 | Are focus indicators visible in both light and dark modes? | | |
| C.7 | Are required fields indicated by more than just color (e.g., asterisk + label text)? | | |
| C.8 | Is the print layout readable when printed in grayscale? | | |

---

## D. Motion & Timing

| #   | Check | Pass/Fail | Notes |
|-----|-------|-----------|-------|
| D.1 | Are there any animations that can't be disabled via `prefers-reduced-motion`? | | |
| D.2 | Is there any auto-playing content or timed interactions? | | |
| D.3 | Do modal open/close animations respect reduced motion preference? | | |

---

## E. Forms & Input

| #   | Check | Pass/Fail | Notes |
|-----|-------|-----------|-------|
| E.1 | Are all form inputs associated with a visible `<label>` (not just placeholder)? | | |
| E.2 | Are required fields marked with both visual indicator and `aria-required`? | | |
| E.3 | Are inline validation errors associated with their field via `aria-describedby`? | | |
| E.4 | Does the file input for CSV upload have an accessible label? | | |
| E.5 | Does the custom card type file input have an accessible label? | | |
| E.6 | Are autocomplete suggestions associated with their input (`aria-controls`, `aria-activedescendant`)? | | |

---

## F. Automated Scan Checklist

Run these tools and record the results here.

| Tool | Command / Action | Violations Found | Notes |
|------|-----------------|------------------|-------|
| axe-core (via Playwright tests) | `npx playwright test e2e/05-accessibility.spec.js` | | |
| Lighthouse Accessibility | DevTools → Lighthouse → Accessibility | /100 | |
| WAVE browser extension | Install from wave.webaim.org, click icon on page | | |
| Color contrast checker | DevTools → Rendering → Emulate vision deficiency | | |

---

## Summary

| Category | Pass | Fail | Critical Issues |
|----------|------|------|-----------------|
| A. Keyboard Navigation | /17 | | |
| B. Screen Reader | /15 | | |
| C. Visual & Color | /8 | | |
| D. Motion & Timing | /3 | | |
| E. Forms & Input | /6 | | |
| F. Automated Scans | | | |

**WCAG 2.1 AA Compliance Estimate:** ___  
**Top 3 Accessibility Issues:**
1.
2.
3.
