# Elemetric — TestFlight Beta Notes

**App version:** 1.0.1 (Build 2)
**Platform:** iOS
**Test period:** Please test over at least 2–3 days and across real or simulated jobs.

---

## What is Elemetric?

Elemetric is a compliance reporting app for licensed Australian tradespeople — plumbers, gas fitters, electricians, HVAC technicians, and carpenters. It uses AI to analyse on-site photos against Australian Standards (AS/NZS series) and generates professional PDF compliance reports with a single tap.

---

## Getting started

1. Download via the TestFlight link provided.
2. Open the app and tap **Create Account** — use your real email or a test email.
3. Complete onboarding (name, licence number, company).
4. Tap **New Job** and select a trade and job type.
5. Fill in job details and proceed through the checklist → photos → AI analysis flow.

**If you are testing the employer portal:** after creating your account, tap your profile and use the "Create Team" option. Then invite a second test account as a team member.

---

## Key flows to test

### 1. Complete job flow (most important)
- [ ] Tap New Job → select **Plumber → Hot Water System**
- [ ] Enter a job name and address (use the autocomplete)
- [ ] Work through the checklist screen — confirm the **live job timer** starts ticking
- [ ] Select a **weather condition** (Clear / Overcast / Rain / Indoor)
- [ ] Tap **Next: Add Photos** and attach at least 3 photos
- [ ] Tap **Run AI Overview** — confirm the loading spinner appears
- [ ] On the AI review screen, check: confidence gauge, risk banner, detected/missing/unclear breakdown
- [ ] If any items show "Retake Photo →", tap it — confirm it returns to photos with that item highlighted in orange
- [ ] Add at least 2 materials (name, qty, brand)
- [ ] Tap **Review Summary & Sign →** — confirm the job summary screen shows photos with PASS/FAIL badges
- [ ] Proceed to Declaration → sign → optionally add client signature → return to AI review
- [ ] Tap **Generate Compliance Report** — confirm PDF opens with correct data
- [ ] Confirm PDF contains: job details, weather, time on site, materials table, photos, signature(s)
- [ ] Tap **Generate Certificate of Compliance** — confirm certificate PDF generates

### 2. AI feedback
- [ ] After viewing AI results, scroll to the "Was this analysis accurate?" section
- [ ] Tap 👍 — confirm it submits instantly and shows the green "Thanks" message
- [ ] On a separate job, tap 👎 — confirm the text input appears, type a comment, tap **Send Feedback**

### 3. Near miss reporting
- [ ] From the home screen, tap **Report Near Miss**
- [ ] Fill in all fields and attach a photo
- [ ] Confirm the report is saved and appears in your job history

### 4. Liability timeline
- [ ] After completing 2–3 jobs, navigate to the **Liability** tab (bottom tab bar)
- [ ] Confirm each job shows the correct 7-year expiry countdown
- [ ] Confirm the status colour is green (active), orange (expiring within 1 year), or grey (expired)

### 5. Employer portal (if testing as employer)
- [ ] Create a team from your profile
- [ ] Invite a second tester by email using the invite screen
- [ ] Have the second tester join via their invite link
- [ ] Confirm the employer dashboard shows the team member with their compliance score
- [ ] Assign a job to the team member
- [ ] Confirm the assigned job appears on the team member's assigned jobs screen

### 6. Visualiser
- [ ] Navigate to the **Visualiser** tab
- [ ] Select a category (e.g. Split System or Gas Heater)
- [ ] Select a brand from the dropdown
- [ ] Confirm the product image loads
- [ ] Test pinch-to-zoom on the product image

### 7. Offline behaviour
- [ ] Enable Airplane Mode after signing in
- [ ] Create a new job, add photos, and run AI analysis
- [ ] Note: AI analysis requires internet — confirm a clear error message appears
- [ ] Complete a job that was previously analysed — confirm the PDF still generates
- [ ] Disable Airplane Mode — confirm the job syncs to the cloud

---

## What to look for

Please pay specific attention to:

- **AI accuracy**: Does the AI correctly identify compliance items in the photos? What does it miss or misidentify? Use the 👍/👎 feedback buttons in the app.
- **PDF quality**: Does the PDF look professional? Is all data correct? Are photos clear?
- **Retake flow**: When tapping "Retake Photo →", does the highlighted item scroll into view and appear with an orange border?
- **Job timer**: Does the timer start immediately when a job is created? Does it display correctly on the checklist screen?
- **Client signature**: Does the signature pad work smoothly? Does it appear correctly in the PDF?
- **Performance**: Any screens that feel slow to load? Any crashes?
- **Error messages**: If something fails (network, camera permission, etc.), is the error message clear and helpful?

---

## Known issues and limitations

| Issue | Status | Workaround |
|-------|--------|------------|
| AI analysis requires internet connection | By design | Run analysis when connected; PDF generates offline |
| Photo stamping (GPS overlay) may take a few seconds | Known | The stamp step runs silently; photos will appear in the grid when ready |
| Visualiser product database is limited to key brands | In progress | More brands will be added before public launch |
| Address autocomplete may be slow on first type | Known | Results appear after ~450ms debounce; allow a moment |
| Employer portal invite emails may land in spam | Known | Check spam folder; add noreply@elemetric.com.au to contacts |
| Timer continues running if app is backgrounded | Known minor | Will be addressed in a future build |

---

## How to give feedback

**Option 1 — In-app AI feedback**
After any AI analysis, use the 👍 / 👎 buttons at the bottom of the AI overview screen. For 👎, describe what the AI got wrong. This goes directly to our database.

**Option 2 — TestFlight feedback**
In the TestFlight app, tap **Send Beta Feedback** from the app listing. You can attach a screenshot.

**Option 3 — Direct message**
Message the development team directly with:
- What you were doing when the issue occurred
- Your phone model and iOS version
- A screenshot if possible

---

## Test accounts

If you do not want to create your own account, use the shared test account:

| Field | Value |
|-------|-------|
| Email | `beta@elemetric.com.au` |
| Password | *(provided separately via TestFlight message)* |
| Role | Individual (free tier) |

**Note:** This account is shared — do not save real personal data to it.

---

## Device requirements

- iPhone with iOS 16.0 or later
- Works best on iPhone 13 or newer
- Internet connection required for: AI analysis, cloud sync, address autocomplete, employer portal
- Internet NOT required for: PDF generation, local job storage, checklist, photo capture

---

## What happens after TestFlight

Beta feedback will be reviewed and incorporated before App Store submission. The public launch will follow TestFlight sign-off. Thank you for helping make Elemetric better for Australian tradespeople.
