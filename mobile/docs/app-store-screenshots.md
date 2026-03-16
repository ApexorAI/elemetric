# Elemetric — App Store Screenshots Guide

## Required sizes

| Device | Canvas size | Required |
|--------|------------|---------|
| iPhone 6.9" (16 Pro Max, 15 Pro Max) | 1320 × 2868 px | ✅ Primary set |
| iPhone 6.5" (11 Pro Max, XS Max) | 1242 × 2688 px | ✅ Secondary set |

Apple requires at minimum the 6.9" set. The 6.5" set will be auto-scaled if omitted, but providing both gives sharper results on older devices.

**Orientation:** Portrait only (`"orientation": "portrait"` in app.json)
**Format:** PNG, no alpha channel
**Max screenshots:** 10 per device size (minimum 1, recommended 6)

---

## Recommended tool

Use **Expo Go** or a **TestFlight build** on a physical **iPhone 15 Pro Max** or **iPhone 16 Pro Max**. Take screenshots with the side button + volume-up shortcut. Export at full resolution. Add captions in **Figma**, **Sketch**, or **Canva** using the overlay template below.

**Caption overlay spec:**
- Background: `#07152b` (navy) bar at the top or bottom, ~180px tall
- Font: SF Pro Display Bold, 42–48px, white
- Sub-label (optional): SF Pro Text Regular, 28px, `rgba(255,255,255,0.65)`
- Orange accent: `#f97316`

---

## Screenshot 1 — Trade & Job Type Selection

**Screen to capture:** `app/trade.tsx`

**Setup:**
1. Launch the app and sign in.
2. Tap **New Job** from the home screen.
3. On the trade screen, select the **Plumber** tab (first tab, default).
4. Ensure all 6 plumber job types are visible: Hot Water System, Gas Rough-In, Drainage, New Installation, Wood Heater, Gas Heater.
5. Do NOT tap any job type — capture the selection screen.

**What to show:**
- The "ELEMETRIC" brand header in orange
- The trade selector tabs (Plumber 🔧, Electrician ⚡, HVAC ❄️, Carpenter 🪚)
- All 6 plumber job type cards with their descriptions and standard references

**Caption:**
> **9 job types across 4 trades**
> *Plumber · Electrician · HVAC · Carpenter*

**Why this screenshot:** It immediately communicates breadth. The App Store user sees this isn't just a single-trade app.

---

## Screenshot 2 — AI Confidence Gauge & Risk Rating

**Screen to capture:** `app/plumbing/ai-review.tsx` after a successful AI analysis

**Setup:**
1. Start a **Hot Water System** job.
2. Add at least 4 photos covering PTR valve, tempering valve, compliance plate, and the existing system.
3. Run AI Overview.
4. Scroll to the top of the result — you want the confidence gauge visible.
5. Use a result with a **high confidence score (80%+)** — this will show the green gauge and "LOW RISK" banner. If needed, use well-lit, clear photos to achieve a high score.

**What to show:**
- The large circular SVG confidence gauge in green (e.g. 87%)
- "LOW RISK" banner below the gauge in green
- "What this means" section with the plain-English explanation
- At least 2–3 green "Detected Items" cards below

**Caption:**
> **AI-powered compliance analysis**
> *Instant confidence score against Australian standards*

**Why this screenshot:** The gauge is the app's most visually distinctive UI element. It creates an immediate "wow" moment for tradespeople who are used to paperwork-heavy processes.

---

## Screenshot 3 — Detailed Breakdown with Retake Flow

**Screen to capture:** `app/plumbing/ai-review.tsx`, scrolled to the breakdown section

**Setup:**
1. Use a result that has a mix: at least 2 detected items, 1 missing item, and 1 unclear item (aim for ~65% confidence — medium score with orange risk).
2. Scroll past the gauge card to show the **Missing Items** breakdown card prominently.
3. The "Retake Photo →" button must be visible next to at least one failed item.

**What to show:**
- Missing Items card with red ✗ icon, item name, specific action text, and orange "Retake Photo →" button
- Unclear Items card below with orange ! icon
- Ideally also show the top of the Detected Items (green ✓) card above

**Caption:**
> **Exactly what to fix**
> *Specific actions for every failed item*

**Why this screenshot:** Shows the app is actionable, not just analytical. The "Retake Photo →" button is a key differentiator.

---

## Screenshot 4 — PDF Compliance Report (first page)

**Source:** Export a completed PDF from a Hot Water or Gas job and screenshot the rendered first page.

**Setup:**
1. Complete a full Hot Water job with all photos, installer name, licence number, and company filled in.
2. Tap **Generate Compliance Report** and save the PDF.
3. Open the PDF in **Files** or **Preview**, screenshot the first full page.
4. Crop to the correct canvas size (1320 × 2868 px).

**What to show:**
- The dark navy ELEMETRIC header with white logo text and QR code
- Orange compliance bar with report type and date
- Executive Summary table: Job Type, Date, Address, Plumber, Licence No., AI Confidence, Weather, Time on Site
- Checklist status table showing at least 3 green "Complete" rows
- Ideally the bottom half begins to show the "Visible Items" section

**Caption:**
> **Professional PDF reports — ready to sign and share**
> *QR-verified · Tamper-evident · Legally compliant*

**Why this screenshot:** Validates the professional output. Many tradespeople currently use hand-written or basic Word documents — this demonstrates the step-change Elemetric provides.

---

## Screenshot 5 — Liability Timeline

**Screen to capture:** `app/(tabs)/liability-timeline.tsx`

**Setup:**
1. Ensure at least 4–5 completed jobs are saved (mix of types and dates).
2. Navigate to the **Liability** tab in the bottom tab bar.
3. The timeline should show jobs with green "Active" status and one showing the orange "Expiring" state if possible.
4. Make sure job names, types, and expiry dates are clearly readable.
5. Do NOT show any real personal names or addresses — use test data like "Smith Residence", "123 Test Street".

**What to show:**
- The section header: "7-Year Liability Window"
- At least 3 job cards with green countdown timers (e.g. "2,438 days remaining")
- The expiry date format (e.g. "Expires 15 Mar 2032")
- Job type badges (Hot Water, Gas, etc.)

**Caption:**
> **7-year liability window — tracked automatically**
> *Know exactly which reports are still active*

**Why this screenshot:** This is a feature unique to Elemetric. No competitor tracks liability windows for tradespeople. It communicates real professional value.

---

## Screenshot 6 — Employer Dashboard

**Screen to capture:** `app/employer/dashboard.tsx`

**Setup:**
1. Sign in as an employer account that has 3–4 team members added.
2. Navigate to **Employer** from the home screen or profile.
3. Ensure each team member shows a compliance score, job count, and last active date.
4. The overall team compliance score widget should be visible at the top.

**What to show:**
- Team name and "Employer Portal" heading
- Overall team compliance score (circular or percentage display)
- 3–4 team member cards with name, score badge, and job count
- "Invite Plumber" or "Assign Job" button visible

**Caption:**
> **Employer portal — your whole team, one screen**
> *Compliance scores · Job history · Team oversight*

**Why this screenshot:** Directly addresses business owners and forepersons, expanding the target audience beyond solo tradespeople.

---

## Optional screenshots (if more than 6 used)

### Screenshot 7 — Near Miss Reporting
**Screen:** `app/near-miss.tsx`
**Caption:** *"Protect yourself before work begins — document pre-existing issues"*

### Screenshot 8 — Job Summary (before signing)
**Screen:** `app/plumbing/job-summary.tsx` with photos showing PASS/FAIL badges
**Caption:** *"Review every photo before you sign"*

### Screenshot 9 — Visualiser
**Screen:** `app/(tabs)/visualiser.tsx` with a product image loaded and zoomed
**Caption:** *"On-site product reference — specs at your fingertips"*

### Screenshot 10 — Profile & Compliance Score
**Screen:** `app/(tabs)/profile.tsx` with compliance score widget showing 80%+
**Caption:** *"Your compliance score — built automatically from every job"*

### Screenshot 11 — 360° Room Analysis (NEW)
**Screen:** `app/plumbing/ai-review.tsx` scrolled to the "360° Room Analysis" card after running `/process-360`
**Setup:** Add a 360° photo from the photo screen, then run AI analysis. The result shows coverage score, detected items, missing from view, recommended photos.
**Caption:** *"360° intelligence — one photo, multiple checklist items detected"*

### Screenshot 12 — Floor Plan with Pins (NEW)
**Screen:** `app/plumbing/floor-plan-pin.tsx` with a floor plan image and 3–4 visible pins from different checklist items
**Setup:** Upload a floor plan in new-job.tsx, then mark several items. Capture the floor plan with orange pins labelled (e.g. "Hot Water Unit", "PTR Valve", "Tempering Valve").
**Caption:** *"Pin every item on the floor plan — included in your PDF"*

---

## Post-production checklist

- [ ] All screenshots taken on iPhone 15 Pro Max or 16 Pro Max (6.9" — 1320×2868 px)
- [ ] Dynamic Island visible and unobstructed at top
- [ ] No real personal data, real addresses, or real licence numbers in any screenshot
- [ ] Status bar shows full signal, Wi-Fi, and 100% battery (use Demo Mode: Settings → Developer → Status Bar)
- [ ] Caption overlay applied consistently across all screenshots (same font, same positioning)
- [ ] Screenshots exported as PNG, no alpha channel
- [ ] Reviewed in App Store Connect preview before submission
- [ ] 6.5" versions generated (scale from 6.9" set or re-capture on iPhone 11 Pro Max)
