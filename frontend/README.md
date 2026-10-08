# SHLMS — Smart Hostel Laundry Management System (Frontend Prototype)

Frontend-only prototype for the Smart Hostel Laundry Management System, built to the
`Frontend_Design_Document_SHLMS.docx` specification. Three portals (Student, Laundry Staff,
Administrator) share one in-memory reactive store, styled in Stripe's dashboard visual language.

There is **no backend, no database, no API and no router**. QR scanning, OTP verification, photo
evidence, claim approval and report export all run in the browser against local state, and the whole
thing resets on reload.

---

## Files

| File | What it is |
| --- | --- |
| `index.html` | Standalone build. Double-click it — React, Tailwind, lucide and Recharts load from CDN and Babel compiles the JSX in the browser. No install, no build step. |
| `shlms_frontend.jsx` | The same app as an importable React component (`export default SHLMSApp`), with real `react` / `lucide-react` / `recharts` imports, for dropping into the Next.js project later. |
| `Frontend_Design_Document_SHLMS.docx` | The design document this implements. |
| `extracted_doc.txt` | Plain-text extraction of the above. |

### Running it

**Fastest:** double-click `index.html`. It needs an internet connection the first time (the CDN
scripts are not vendored); if a CDN is unreachable the page says exactly which library failed instead
of showing a blank screen.

**In a React project:**

```jsx
import SHLMSApp from "./shlms_frontend.jsx";
// requires: react ^18, lucide-react, recharts, and Tailwind CSS configured
```

---

## Design tokens

Taken directly from Section 4 of the design document, and used through Tailwind's built-in scales
rather than one-off hex values.

| Token | Value | Role |
| --- | --- | --- |
| Indigo 600 | `#4F46E5` | Primary buttons, active nav, stepper fill, chart accent |
| Slate 900 | `#0F172A` | Headings and primary text |
| Slate 500 | `#64748B` | Captions, labels, helper text |
| Slate 50 | `#F8FAFC` | Page background behind cards |
| Slate 200 | `#E2E8F0` | Card borders, table dividers |
| Emerald 500 | `#10B981` | Delivered / resolved / active |
| Amber 500 | `#F59E0B` | Drying / under review |
| Rose 600 | `#E11D48` | Open complaints, errors, suspended |

Typography is Inter at 600 / 500 / 400 — one family throughout, as specified. Cards use a 12px
radius, buttons and inputs 8px, a single 1px border colour, and one subtle ambient shadow.

---

## Component architecture

Shared vocabulary, reused across all three portals rather than styled per screen:

| Component | Purpose |
| --- | --- |
| `StoreProvider` / `useStore` | The single reactive state tree and every action that mutates it |
| `Shell` | Sidebar + top bar layout wrapper, with mobile drawer and notification centre |
| `LaundryStepper` | Signature element — Stripe's payment-lifecycle indicator, repurposed for the laundry pipeline |
| `Card`, `Button`, `StatCard`, `StatusPill`, `SectionHeader`, `Table`, `EmptyState` | Layout and data primitives |
| `Modal`, `Field`, `Input`, `Textarea`, `Select`, `SearchBar`, `FilterDropdown` | Forms, dialogs, search and filtering |
| `StarRating`, `ProgressBar`, `PhotoPicker`, `OtpInput`, `ScannerViewfinder` | Interaction-specific controls |
| `ToastHost`, `NotificationBell` | Feedback surfaces (toasts + the simulated email/in-app feed) |

### State model

One store in `StoreProvider` holds `records`, `complaints`, `lostItems`, `users`, `schedule`,
`blackouts`, `feedback`, `notifications` and `toasts`. Because all three portals read from it, an
action in one portal is visible in the others immediately:

| Action | Cross-portal effect |
| --- | --- |
| Staff submits a scanned bag | New record appears in Student → Track, and in Admin → Analytics block volume |
| Staff advances a stage | Student stepper moves; an OTP is generated on reaching *Ready for Pickup* |
| Staff verifies the OTP | Record closes as *Delivered*; student sees the pickup-confirmation notification |
| Student raises a complaint | Lands in the Admin complaint queue with its photo evidence |
| Admin resolves a complaint | Student's ticket flips to *Resolved* with the resolution note; donut chart updates |
| Student claims a lost item | Item moves to *Claim Pending* and enters the Admin verification queue |
| Admin approves/rejects a claim | Item becomes *Returned* or goes back on the student board |
| Admin reassigns a block day | Student's "next laundry day" changes; staff are notified |

The laundry pipeline is `Scheduled → Received → Washing → Drying → Ready for Pickup → Delivered`.
Delivery is deliberately *not* reachable from the queue's quick-advance button — it can only happen
through OTP verification on the Verify & Deliver screen.

---

## Screens

**Student** — Overview (next laundry day, live stepper, quick actions, notification feed) · Track
Laundry (full stepper with per-step timestamps, itemised breakdown, searchable record table) ·
History (completed cycles + digital receipt modal) · Complaints (filterable list, raise-complaint
modal with category, description and photo preview) · Lost & Found (card grid with claim modal) ·
Feedback (overall stars plus cleanliness / speed / garment-care dimensions).

**Laundry Staff** — Today's Queue (stat cards, search, per-stage filter, one-click stage advance) ·
Scan & Submit (animated barcode viewfinder, auto-filled student details, per-garment counter with
live weight, remarks) · Verify & Deliver (six-box OTP entry with auto-advance and paste support,
success banner plus simulated confirmation email) · Upload Lost Item (drag-and-drop photo preview).

**Administrator** — Analytics (stat cards, weekly load bar chart, live complaint donut, block-wise
volume bars, operations snapshot) · Manage Users (search, role filter, validated add-user modal,
suspend/activate, remove) · Laundry Schedule (block cards, reassign modal showing affected student
counts, holiday/maintenance blackout manager) · Complaints (queue with review modal showing photo
evidence and resolution note) · Lost & Found (claim verification queue with approve/reject) · Reports
(four report types, animated build progress, real PDF and CSV downloads).

---

## Mapping to SRS features and use cases

Section 8 of the design document, implemented:

| Screen | SRS requirement | Use case |
| --- | --- | --- |
| Landing | REQ-AUTH-01 – 04 | Log In |
| Student Overview / Track | REQ-TRK-01 – 03 | Track Laundry Status |
| Student History | REQ-HIS-01 – 02 | View Laundry History |
| Student Complaints | REQ-CMP-01 – 04 | Raise Complaint, Attach Photo Evidence |
| Student Lost & Found | REQ-LF-02 | Browse and Claim Lost Item |
| Student Feedback | REQ-FBK-01 – 02 | Submit Feedback |
| Staff Queue | REQ-SCH-03, REQ-STD-01 – 02 | View Assigned Schedule |
| Staff Scan & Submit | REQ-QR-01 – 03, REQ-SUB-01 – 04 | Record Laundry Submission, Scan Student Barcode |
| Staff Verify & Deliver | REQ-OTP-01 – 03 | Complete Laundry Handover, Verify Pickup OTP |
| Staff Lost & Found Upload | REQ-LF-01 | Upload Lost Item |
| Admin Analytics | REQ-ADA-01 – 02 | View Analytics Dashboard, Monitor Laundry Operations |
| Admin Users | REQ-AUTH-04 | Manage User Accounts |
| Admin Schedule | REQ-SCH-01 – 02 | Manage Laundry Schedule |
| Admin Complaints | REQ-CMP-03 – 04 | Resolve Complaint |
| Admin Lost & Found | REQ-LF-03 – 04 | Verify Lost Item Claim |
| Admin Reports | REQ-RPT-01 – 02 | Generate Report, Export Report (PDF / Excel) |

---

## Real vs simulated

**Actually works in the browser:** photo attachment and preview (`FileReader`), OTP generation and
verification, all search / filter / validation logic, cross-portal state propagation, the Recharts
charts, and report export — the Excel button writes a real CSV and the PDF button writes a real,
hand-built single-page PDF, both downloaded via a Blob.

**Simulated:** the barcode scan (a 1.6 s reader animation over a picked sample student, no camera),
the pickup-confirmation email (a banner, no mail service), and the weekly-load bar chart, which uses
the fixed sample figures from the design document rather than live aggregation. Everything else on
the admin dashboard is computed from live session state.

---

## Known limitations

- No backend, database or authentication — the landing page stands in for the login step.
- No routing library; switching portals or screens resets unsaved form state, and reloading resets
  everything to the seed data.
- The weekly-load chart is sample data, as noted above.
- Layout targets desktop and tablet first; below tablet width the sidebar collapses into a drawer and
  tables scroll horizontally, but the dense admin screens are still most comfortable on a laptop.

---

## Keeping the two files in sync

`index.html` embeds the component source verbatim. `shlms_frontend.jsx` ends its import block with a
`/* @imports-end */` marker; everything after that marker is what sits inside the
`<script type="text/babel">` block in `index.html`, below a short prelude that destructures the same
symbols off the UMD globals (`React`, `Recharts`, `LucideReact`). If you edit the `.jsx`, re-paste
that section into `index.html` — or delete the HTML's script body and paste it fresh.

---

## Verification checklist

Open `index.html` and walk through:

1. **Landing** — metrics banner reads from live state; each role card enters its portal.
2. **Student** — stepper on Overview; Track loads any record from the table; History opens a receipt;
   raise a complaint with a photo; claim a Lost & Found item; submit a star rating.
3. **Staff** — advance a bag a stage from the queue; simulate a scan, count garments, submit the bag;
   verify a pickup OTP (`LR-1048` seeds with `204877`; the student portal shows the live OTP for its
   own bag); upload a lost item.
4. **Admin** — charts render; add a user and suspend them; reassign a block's laundry day; resolve a
   complaint from the review modal; approve a Lost & Found claim; export a report as PDF and Excel.
5. **Cross-portal** — a bag submitted in the Staff portal shows up under Student → Track and in the
   Admin block-volume bars without a reload.
