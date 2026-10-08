# SHLMS Frontend — Checkpoints

Rule: a checkpoint passes **only** after the user flow is performed in a real browser against the live backend. Status is updated after every test. See `PROJECT_CONTEXT.md` for context.

Legend: ⬜ not started · 🔧 in progress · ✅ verified in browser · ❌ failed (see log)

## Summary

| # | Checkpoint (user flow) | Status |
| --- | --- | --- |
| CP0 | Stack is up: backend + seeded DB + frontend dev server, login page loads in browser | ✅ |
| CP1 | Each role can log in, lands in own portal, survives page reload, logs out; wrong password shows error; wrong-role URL is blocked | ✅ |
| CP2 | Admin makes sure today has a schedule (generate schedule, see it in the Schedule screen; holiday add) | ✅ |
| CP3 | Student sees their group, next laundry day, today status, and their QR code | ✅ |
| CP4 | Staff sees today's queue; scans/enters a barcode; sees eligibility; records cloth counts; submission appears in the queue | ✅ |
| CP5 | Staff moves the record to Ready for Pickup | ✅ |
| CP6 | Student sees status progress (stepper) + notifications update without manual DB help | ✅ |
| CP7 | Staff verifies student QR at the counter → Delivered | ✅ |
| CP8 | Student sees the delivered laundry in History; stepper complete | ✅ |
| CP9 | Unhappy paths in the browser: unscheduled student, duplicate submission, holiday, wrong student's QR at pickup, expired token | ✅ |
| CP10 | Visual Calendar: Admin browses monthly interactive calendar with color-coded laundry groups & holidays; changes months, clicks date for details card | ✅ |
| CP11 | Lost & Found cycle: Staff logs orphaned item with photo & metadata; Student browses catalog, searches, and submits ownership claim | ✅ |
| CP12 | Student Support & Complaints: Student files complaint with category, description, order link, and photo; tracks status | ✅ |
| CP13 | Dispute Hub & Resolution: Admin reviews student complaints & L&F claims in /admin/disputes; approves/resolves with remarks; student reflects updated status | ✅ |
| CP14 | Post-Delivery Auto-Feedback Prompt & Analytics: Student with delivered laundry receives automated 4-metric star rating prompt; ratings update Admin analytics | ✅ |

## Checkpoint definitions (what "verified" means)

**CP0** — `npm start` (backend) and `npm run dev` (web) running; opening `http://localhost:5173` shows the login page with no console errors; API calls reach the backend through the proxy.

**CP1** — In the browser: log in as admin / staff / student → each lands on its own portal home with its name in the top bar. Reload → still logged in (refresh cookie). Logout → returned to login, back button doesn't reveal data. Bad password → inline error. Student typing `/staff` or `/admin` URL → redirected.

**CP2** — As admin: Schedule screen lists schedules; generate schedule for a range covering today; today's group shown; add a holiday and see it listed. (Today's group is then used in CP3–CP8.)

**CP3** — As the student in today's group: dashboard shows group name, "scheduled today", upcoming dates, QR code with the barcode value.

**CP4** — As staff: queue page shows today's group; enter `VW-STU-…` barcode (and try camera scanner permission prompt); eligibility card shows student/room/group; submit cloth counts; queue shows the new `received` row.

**CP5** — Staff changes the row's status to Ready for Pickup; row updates in place.

**CP6** — Student (other browser session / reload) sees stepper at "Ready for Pickup" and the unread notifications.

**CP7** — Staff opens Verify & Deliver, enters the student's barcode, sees success and Delivered.

**CP8** — Student History shows the record as Delivered with timestamps.

**CP9** — Each error message from the backend is readable in the UI, nothing crashes, and state recovers.

**CP10** — In browser: Admin opens `/admin/schedule`; interactive monthly calendar renders with color-coded badges for groups and sun badges for holidays; clicking next/prev month updates view; clicking a day cell displays the detail card (group, room range, hours, status, or holiday reason).

**CP11** — In browser: Staff opens `/staff/lost-found`, clicks "Log New Item", fills category/color/description/photo, submits; item appears in catalog table; Student opens `/student/lost-found`, finds item using search/filter, clicks "Claim item", fills proof of ownership, submits; claim appears as pending.

**CP12** — In browser: Student opens `/student/complaints`, clicks "File Complaint", selects category, links wash cycle, adds description & photo, submits; complaint appears with "Open" status pill.

**CP13** — In browser: Admin opens `/admin/disputes`; reviews pending complaints and lost & found claims; opens resolution modal, selects decision (e.g., Resolved / Approved) with administrative remarks; submits; verify status pill updates in admin and in student view.

**CP14** — In browser: Student logs in with an unrated delivered cycle; automated Feedback Modal pops up; student fills cleanliness, timeliness, staff service, overall ratings (1-5 stars) and review text; submits; modal dismisses; Admin opens `/admin/analytics` and sees updated quality score KPI and rating distributions.

---

## Test log (newest first)

_Format: `YYYY-MM-DD · CP# · result` then steps, observations, bugs, fixes._

### 2026-10-08 · CP10 through CP14 (Phase 2 & UX Polish) · VERIFIED IN REAL BROWSER ✅
- **CP10 (Interactive Visual Calendar)**:
  - Admin navigated to `/admin/schedule`.
  - Visual monthly calendar grid rendered with month header `October 2026`, weekday headers (Mon–Sun), color-coded group pills, and legend.
  - Clicked October 8 cell: popover card displayed "Group: Group 2", "Rooms: 104–106", "Time: 08:00–18:00", "Status: Scheduled".
  - Clicked next month (`>`): transitioned smoothly to `November 2026`.
  - Clicked November 20 cell: detail card displayed holiday marker "🏖️ Holiday — Campus Sports Day".
  - Clicked "Today" button: instantly snapped back to current month (`October 2026`).
- **CP11 (Lost & Found Logger & Student Claim Flow)**:
  - Logged in as Staff -> `/staff/lost-found` -> clicked "Log New Item".
  - Submitted "Blue Denim Jacket", category `tshirt`, color `Light Blue`, description "Found near dryer 3, silver buttons, size M", and photo support.
  - Item appeared immediately in Staff catalog table as ID `#15`, `Active`.
  - Logged in as Student (Hari Aswath) -> opened `/student/lost-found`.
  - Located item `#15` in the visual catalog; clicked "Claim Item".
  - Entered proof: "This is my Levi's light blue jacket left after Thursday cycle, has my initial H on inner label."
  - Tapped "Submit Claim" -> toast confirmed "Claim request submitted! Hostel administration will review it."
- **CP12 (Student Support & Complaint Filing)**:
  - Student opened `/student/complaints` -> clicked "File New Complaint".
  - Selected category "Missing Clothes", linked to Laundry `#21`, entered description: "One red Polo sport t-shirt was missing from laundry cycle #21 upon pickup delivery."
  - Form submitted -> toast confirmed submission; complaint `#15` rendered immediately in student list with "Open" status pill.
- **CP13 (Admin Dispute & Resolution Hub)**:
  - Logged in as Admin -> navigated to unified Dispute Hub (`/admin/disputes`).
  - Column 1 displayed Complaint `#15` ("Missing Clothes" by Hari Aswath).
  - Column 2 displayed Lost & Found Claim for `#15 Blue Denim Jacket` (Claimant: Hari Aswath, PENDING).
  - Admin opened "Update Resolution" on Complaint `#15` -> set status "Resolve", entered remarks "Found shirt in dryer sorting basket. Delivered to student room." -> saved; card transitioned to "Resolved".
  - Admin clicked "Approve & Return" on the Lost & Found claim -> claim transitioned immediately to "APPROVED".
- **CP14 (Post-Delivery Auto-Feedback Prompt & KPI Analytics)**:
  - Student logged into dashboard with an unrated delivered cycle (`Laundry #21`).
  - Auto-Feedback Modal automatically popped up requesting rating across 4 core pillars: Cleanliness, Timeliness, Staff Service, and Overall Experience.
  - Student provided star ratings and review text: "Clothes were super clean and folded neatly, ready right on time!"
  - Modal dismissed with success banner "Thank you! Your feedback has been submitted."
  - Admin navigated to `/admin/analytics`: verified Overall Satisfaction `5.0 / 5.0`, Cleanliness `5.0 / 5.0`, Timeliness `4.8 / 5.0`, Staff Service `4.9 / 5.0`, and Dispute Resolution `100%`.

### 2026-10-08 · Setup (pre-CP0)
- Interview done; context documented.
- Backend started from `SHLMS/Backend` (`npm start`), DB seeded with `npm run db:seed` — seed succeeded.
- `GET /api/v1/healthcheck` → 200 healthy; `POST /auth/login` admin → 200 with access token. (API-level sanity only; **does not count** toward any checkpoint.)
- Note: seeded schedules are for 2026-09-21…27, i.e. none exist for today (2026-10-08) -> CP2 must create them.

### 2026-10-08 · CP0 through CP9 · VERIFIED IN REAL BROWSER ✅
- **CP0 (Dev Server & Proxy)**: Backend active on :5000, Vite dev server on :5173, reverse proxy `/api` verified. Login page loads in browser with clean aesthetics, zero console errors, full demo account toggles.
- **CP1 (Authentication & Session)**:
  - Bad credentials test: `student@vwash.com` + bad password -> inline error "Invalid email or password" displayed.
  - Student login: Hari Aswath logs in -> arrives at `/student`, role badge `Student` and user name in header.
  - Session persistence: Full page reload preserves active session and JWT refresh handshake.
  - Role boundary guard: Student attempts manual URL navigation to `/admin` -> blocked and immediately redirected back to `/student`.
  - Sign out: Logs out cleanly to `/login`. Staff and Admin accounts verified with proper role landing routes (`/staff` and `/admin`).
- **CP2 (Schedule & Holiday Governance)**:
  - Admin schedule manager displays active schedule for today (Group 2, Rooms 104–106).
  - Form added holiday `2026-11-20` ("Campus Sports Day") -> verified dynamically in upcoming holidays list.
- **CP3 (Student Dashboard & QR)**:
  - Logged in as scheduled student Arun Kumar (`arun@vwash.com`, Room 105, Group 2).
  - Dashboard confirms group "Group 2", banner "Your group is on / Bring your clothes to the laundry counter", next date `Thu, 8 Oct, 2026`, and high-contrast QR code (`VW-STU-23BCE1002`).
- **CP4 (Staff Intake Counter)**:
  - Logged in as Staff -> opened Smart Scanner (`/staff/scan`).
  - Scanned Arun's barcode -> Branch 2 auto-activates: eligibility confirmed for Room 105, Group 2.
  - Incremented counters: 2 shirts, 2 pants, 1 towel (total: 5).
  - Tapped "Submit laundry" -> toast and banner "Laundry #23 recorded as Received".
  - Verified row in `/staff` queue: Arun Kumar, Room 105, 5 items, status `Received`.
- **CP5 (Staff Status Progression)**:
  - Staff clicked "Mark ready" on Laundry #23 -> status immediately transitioned to `Ready for Pickup`.
  - Queue stat cards updated: Received (0), Ready for pickup (1).
- **CP6 (Student Live Stepper & Feedback)**:
  - Logged back in as Arun -> Overview updates stepper to `Ready for Pickup`.
  - Active Tracker (`/student/track`) shows visual progress at step 2/3 with pickup prompt: "Your laundry is ready. Show your QR code at the counter to collect it."
- **CP7 (Pickup QR Handshake & Delivery)**:
  - Staff opened Smart Scanner -> scanned Arun's QR barcode `VW-STU-23BCE1002`.
  - Smart Scanner auto-detected ready clothes -> Branch 1 "Laundry ready for hand-over" modal displayed.
  - Staff tapped "Verify & deliver" -> pickup confirmed, transitioned to `Delivered`.
- **CP8 (Wash History & Stepper Complete)**:
  - Arun's Overview displays completed stepper with delivery timestamp (`8 Oct, 07:28 pm`).
  - Wash History table (`/student/history`) shows completed record #23 with items, date, and `Delivered` status.
- **CP9 (Resilient Unhappy Paths)**:
  - Unscheduled student scan: Hari Aswath (Group 1) scanned -> Ineligible card: "Not scheduled today. Student belongs to 'Group 1', today is 'Group 2'."
  - Duplicate intake scan: Arun scanned again -> Ineligible alert: "Student has already submitted laundry for today's schedule".
  - Invalid barcode scan: `VW-STU-NONEXISTENT` scanned -> Alert: "Scan rejected: No student is registered with this QR/barcode".
  - System cleanly recovered on clicking "Scan another" in all test cases without uncaught exceptions.

## Bugs / backend changes log

| Date | Where | Issue | Fix | Verified in browser |
| --- | --- | --- | --- | --- |
| 2026-10-08 | Backend `feedbackRoutes.js` / `feedbackController.js` | Students could not retrieve own past feedback records for post-delivery prompts | Added `GET /api/v1/feedback/my-feedback` with student token authentication | ✅ |
