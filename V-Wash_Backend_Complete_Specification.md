# V-Wash -- Smart Hostel Laundry Management System

## Backend Implementation & System Specification

**Version:** 1.0.0\
**Project Type:** Web-based Hostel Laundry Management System\
**Backend:** Node.js + Express.js\
**Frontend:** React.js\
**Database:** PostgreSQL\
**ORM:** Drizzle ORM\
**Authentication:** JWT + HTTP-only Refresh Cookies\
**Password Hashing:** bcryptjs

------------------------------------------------------------------------

## 1. Project Overview

V-Wash is a web-based laundry management system designed for a large
hostel environment of approximately 3,000 students. It replaces manual
laundry records and paper schedules with a centralized system for
students, laundry staff, and administrators.

The system uses room/floor-based laundry groups and a **round-robin
scheduling model**. Students do not freely compete for available dates.
Instead, the backend assigns the next laundry group to each working
laundry day.

The main laundry status flow is:

`Received → Ready to Pick Up → Delivered`

Students are identified using a unique QR/barcode. Staff scan the
student's code during submission and pickup. The backend verifies the
student's identity, assigned group, current schedule, and laundry
ownership.

------------------------------------------------------------------------

## 2. Technology Stack

-   **Frontend:** React.js
-   **Backend:** Node.js + Express.js
-   **Database:** PostgreSQL
-   **ORM:** Drizzle ORM
-   **Authentication:** JWT
-   **Refresh Token:** HTTP-only secure cookie
-   **Password Hashing:** bcryptjs
-   **Validation:** Zod
-   **API Testing:** Postman
-   **Image Storage:** Cloudinary or equivalent
-   **Version Control:** Git + GitHub

------------------------------------------------------------------------

## 3. User Roles

### Student

Students can:

-   Login/logout.
-   View their assigned laundry schedule.
-   View current laundry status.
-   View laundry history.
-   Use their QR/barcode for identification.
-   Raise complaints.
-   View and claim Lost & Found items.
-   Submit feedback.
-   View notifications.
-   View their profile.

Students cannot create users, change schedules, update laundry status,
resolve complaints, or approve claims.

### Laundry Staff

Staff accounts are created by Admin.

Staff can:

-   View today's laundry schedule.
-   View today's expected queue.
-   Scan student QR/barcodes.
-   Verify whether a student is scheduled today.
-   Record laundry submission.
-   Record cloth details.
-   Update laundry status.
-   Verify pickup using the student's QR/barcode.
-   Mark laundry as delivered.
-   View operational laundry records.
-   Upload Lost & Found items.

Staff cannot create accounts, modify the rotation, resolve complaints,
or approve Lost & Found claims.

### Admin

Admin can:

-   Create and manage students and staff.
-   Activate/deactivate accounts.
-   Configure hostel blocks, floors, rooms, and laundry groups.
-   Configure the rotation.
-   Generate and manage schedules.
-   Mark holidays/no-laundry days.
-   Monitor laundry operations.
-   Manage complaints.
-   Verify Lost & Found claims.
-   View feedback and reports.
-   Monitor overall system activity.

------------------------------------------------------------------------

## 4. Backend Architecture

Suggested structure:

``` text
src/
├── app.js
├── server.js
├── config/
│   ├── env.js
│   └── db.js
├── db/
│   ├── schema.js
│   ├── relations.js
│   └── seed.js
├── middleware/
│   ├── authMiddleware.js
│   ├── requireRole.js
│   ├── validationMiddleware.js
│   └── errorMiddleware.js
├── modules/
│   ├── auth/
│   ├── users/
│   ├── hostel/
│   ├── schedules/
│   ├── laundry/
│   ├── complaints/
│   ├── lostFound/
│   ├── feedback/
│   ├── notifications/
│   └── reports/
└── utils/
    ├── jwt.js
    ├── password.js
    ├── barcode.js
    └── scheduler.js
```

Controllers should handle HTTP requests, services should contain
business logic, and Drizzle should handle database access.

------------------------------------------------------------------------

## 5. Authentication

### Login

`POST /api/v1/auth/login`

The backend should:

1.  Find the user.
2.  Check account status.
3.  Compare password using bcryptjs.
4.  Generate a short-lived access token.
5.  Generate a refresh token.
6.  Store/rotate refresh-token information securely.
7.  Send the refresh token through an HTTP-only secure cookie.
8.  Return the access token and safe user information.

Example JWT payload:

``` json
{
  "sub": "user-id",
  "role": "student"
}
```

### Authentication Endpoints

``` text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Passwords must never be stored in plain text.

------------------------------------------------------------------------

## 6. Role-Based Authorization

Authentication determines who the user is. Authorization determines what
the user can do.

Example:

``` text
authenticate
    ↓
requireRole("admin")
    ↓
controller
```

The backend must obtain the role from the authenticated user/token and
must not trust a role sent by the frontend.

------------------------------------------------------------------------

## 7. User Management

### Student Creation

Admin creates students with information such as:

-   Name
-   Student ID
-   Email
-   Phone
-   Hostel
-   Floor
-   Room
-   QR/barcode identifier
-   Account status

### Staff Creation

Only Admin creates staff accounts.

Example:

``` text
Admin
 ↓
Staff Management
 ↓
Create Staff
 ↓
Enter details
 ↓
Hash password
 ↓
role = staff
 ↓
Save
```

Typical fields:

-   Name
-   Employee ID
-   Email
-   Phone
-   Assigned block/operational area
-   Role
-   Status

Staff cannot create other staff accounts.

### Admin Creation

Admin accounts should only be created through a controlled
administrative setup process. Public registration for Admin should not
exist.

------------------------------------------------------------------------

## 8. Hostel Structure

The database should represent:

``` text
Hostel Block
    ↓
Floor
    ↓
Room
    ↓
Student
```

Example:

``` text
D Block
├── Floor 1
│   ├── Room 101
│   └── Room 102
├── Floor 2
│   ├── Room 234
│   └── Room 235
└── ...
```

The system should allow Admin to configure groups based on the actual
hostel structure.

------------------------------------------------------------------------

## 9. Laundry Groups

Students are assigned to laundry groups using their hostel/room
configuration.

Example:

``` text
Group 1 → Rooms 101–233
Group 2 → Rooms 234–427
Group 3 → Rooms 428–619
Group 4 → Rooms 620–810
Group 5 → Rooms 811–1004
```

A group can represent a room range, floor, block/floor combination, or
another configured unit.

The group assignment should be stored or deterministically derived from
the student's room.

------------------------------------------------------------------------

# 10. Scheduling Model

## 10.1 Why Round-Robin Scheduling?

With approximately 3,000 students, allowing students to freely choose
dates can create competition for early slots and make the system
difficult to operate.

The real hostel process is closer to:

``` text
Hostel/Floor/Room Group
        ↓
Assigned Laundry Date
        ↓
Student submits during that date
```

V-Wash digitizes this process using a rotating allocation.

The key principle is:

> **The next working laundry day receives the next group in the
> rotation.**

The weekday itself does not permanently determine a group.

------------------------------------------------------------------------

## 10.2 Rotation

If there are five groups:

``` text
G1 → G2 → G3 → G4 → G5 → G1 → G2 → ...
```

Example:

  Date     Group
  -------- -------
  Sep 21   G1
  Sep 22   G2
  Sep 23   G3
  Sep 24   G4
  Sep 25   G5
  Sep 26   G1
  Sep 27   G2

------------------------------------------------------------------------

## 10.3 Holiday Handling

This is an important business rule.

If Friday is a holiday, the group scheduled for Friday should **not** be
forced to wait until the next Friday.

A holiday does not advance the rotation.

Example:

``` text
Monday    → G1
Tuesday   → G2
Wednesday → G3
Thursday  → G4
Friday    → HOLIDAY
Saturday  → G5
Sunday    → G1
```

The rotation only advances on a valid working laundry day.

For multiple holidays:

``` text
Thursday  → G4
Friday    → HOLIDAY
Saturday  → HOLIDAY
Sunday    → G5
```

G5 is still the next group after G4.

------------------------------------------------------------------------

## 10.4 Scheduling Algorithm

Maintain:

``` text
groups = [G1, G2, G3, G4, G5]
rotationIndex
```

For each calendar date:

``` text
if date is a holiday:
    create no normal laundry allocation
    do not increment rotationIndex
else:
    assign groups[rotationIndex]
    create schedule
    rotationIndex =
        (rotationIndex + 1) % groups.length
```

The scheduler should run from a known initial rotation state.

The Admin should be able to see the current rotation position.

------------------------------------------------------------------------

## 10.5 Schedule Generation

Example:

``` text
Initial rotation = G1

Sep 21 → G1
Sep 22 → G2
Sep 23 → G3
Sep 24 → G4
Sep 25 → HOLIDAY
Sep 26 → G5
Sep 27 → G1
```

Already completed schedules should not be silently changed.

If Admin needs to make a correction, the backend should explicitly
record the change.

------------------------------------------------------------------------

## 10.6 Time Slots

A large group can optionally be divided into time windows.

Example:

``` text
Group 3 → Rooms 428–619

08:00–10:00 → Rooms 428–480
10:00–12:00 → Rooms 481–540
14:00–16:00 → Rooms 541–580
16:00–18:00 → Rooms 581–619
```

Students should not compete for these slots. The system can assign a
time window using room ranges or configured subgroups.

------------------------------------------------------------------------

# 11. Student Schedule Verification

The backend determines whether a student is allowed to submit laundry
today.

Example:

``` text
Student
 ↓
Room 542
 ↓
Group 3
 ↓
Today's schedule
 ↓
Group 3
 ↓
MATCH
```

The student can then submit laundry.

If:

``` text
Student Group = G3
Today's Group = G2
```

the backend rejects the submission.

The frontend should display the assigned date instead of allowing the
student to select an arbitrary date.

------------------------------------------------------------------------

# 12. QR/Barcode Identification

Each student receives a unique QR/barcode identifier.

Example:

``` text
VW-STU-23BCE1234
```

The code should identify the student. It should not contain unnecessary
sensitive information.

Submission flow:

``` text
Staff scans QR
      ↓
Backend finds student
      ↓
Check active account
      ↓
Find student's group
      ↓
Find today's schedule
      ↓
Compare group
      ↓
MATCH?
 ┌────┴────┐
YES        NO
 ↓          ↓
Accept     Reject
```

The backend remains the source of truth.

------------------------------------------------------------------------

# 13. Laundry Submission

When the student is verified:

1.  Staff enters cloth details.
2.  Backend validates the request.
3.  Backend checks duplicate active submission.
4.  A laundry record is created.
5.  Status is set to `received`.
6.  A notification can be generated.

Example cloth details:

``` json
{
  "shirts": 3,
  "pants": 2,
  "tshirts": 4,
  "bedsheets": 1
}
```

The record should store the submitting staff member and timestamp.

------------------------------------------------------------------------

# 14. Laundry Status

Only three primary statuses are required:

``` text
received
ready_for_pickup
delivered
```

Flow:

``` text
Received
   ↓
Ready to Pick Up
   ↓
Delivered
```

The backend must reject invalid backward transitions such as:

``` text
Delivered → Received
Delivered → Ready to Pick Up
```

------------------------------------------------------------------------

# 15. Pickup Verification

OTP is not used as the project's pickup verification mechanism.

The student is identified using their QR/barcode.

Flow:

``` text
Student arrives
      ↓
Staff scans QR/barcode
      ↓
Find student
      ↓
Find student's active laundry
      ↓
Check status = ready_for_pickup
      ↓
Verify ownership
      ↓
Hand over laundry
      ↓
Mark delivered
```

The backend must verify:

-   Student exists.
-   Student is active.
-   Laundry belongs to the student.
-   Laundry is ready for pickup.
-   Laundry is not already delivered.
-   Staff is authorized.

------------------------------------------------------------------------

# 16. Laundry Queue

Staff should have an endpoint to view today's queue.

Example:

  Student   Room   Group   Submission
  --------- ------ ------- ------------
  Hari      542    G3      Pending
  Arun      550    G3      Received
  Karthik   601    G3      Pending

Useful daily statistics:

``` text
Expected Students
Submitted
Pending
Received
Ready for Pickup
Delivered
```

------------------------------------------------------------------------

# 17. Complaints

Students can raise complaints related to laundry.

Categories:

-   Missing clothes
-   Damaged clothes
-   Wrong item
-   Delay
-   Other

Complaint statuses:

``` text
open
under_review
resolved
rejected
closed
```

Students can create and view their own complaints.

Admin can investigate and update complaint status.

Suggested fields:

``` text
id
studentId
laundryId
category
description
imageUrl
status
adminRemarks
resolvedBy
resolvedAt
createdAt
updatedAt
```

------------------------------------------------------------------------

# 18. Lost & Found

Staff can upload items found during laundry operations.

Fields:

``` text
title
description
category
color
imageUrl
foundDate
reportedByStaffId
status
```

Flow:

``` text
Staff finds item
      ↓
Upload
      ↓
Available
      ↓
Student submits claim
      ↓
Admin reviews
      ↓
Approved / Rejected
      ↓
Returned
```

Students can browse available items and submit claims.

------------------------------------------------------------------------

# 19. Feedback

Students can provide feedback after receiving laundry.

Ratings:

``` text
Cleanliness: 1–5
Timeliness: 1–5
Staff Service: 1–5
Overall: 1–5
```

Optional comment can be stored.

Admin can view aggregated feedback and trends.

------------------------------------------------------------------------

# 20. Notifications

Notifications should be generated for:

-   Assigned laundry schedule.
-   Laundry received.
-   Laundry ready for pickup.
-   Laundry delivered.
-   Complaint status changes.
-   Lost & Found claim decisions.

Suggested table:

``` text
id
userId
type
title
message
isRead
createdAt
```

------------------------------------------------------------------------

# 21. Permission Matrix

  Feature                           Student     Staff   Admin
  ------------------------------- --------- --------- -------
  Login                                   ✓         ✓       ✓
  View own profile                        ✓         ✓       ✓
  View own schedule                       ✓         ✓       ✓
  Manage rotation                         ✗         ✗       ✓
  Mark holiday                            ✗         ✗       ✓
  View today's schedule                   ✓         ✓       ✓
  Scan student QR                         ✗         ✓       ✓
  Verify submission eligibility           ✗         ✓       ✓
  Submit/record laundry                   ✗         ✓       ✓
  View own laundry                        ✓         ✗       ✓
  View operational laundry                ✗         ✓       ✓
  Update laundry status                   ✗         ✓       ✓
  Verify pickup                           ✗         ✓       ✓
  Mark delivered                          ✗         ✓       ✓
  Create student                          ✗         ✗       ✓
  Create staff                            ✗         ✗       ✓
  Manage users                            ✗         ✗       ✓
  Raise complaint                         ✓         ✗       ✓
  Resolve complaint                       ✗         ✗       ✓
  Upload Lost & Found item                ✗         ✓       ✓
  Claim Lost & Found item                 ✓         ✗       ✓
  Verify Lost & Found claim               ✗         ✗       ✓
  Submit feedback                         ✓         ✗       ✗
  View feedback analytics                 ✗         ✗       ✓
  View reports                            ✗   Limited       ✓
  View notifications                      ✓         ✓       ✓

------------------------------------------------------------------------

# 22. API Design

All APIs use:

``` text
/api/v1
```

## Authentication

``` text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Users

``` text
POST  /api/v1/users
GET   /api/v1/users
GET   /api/v1/users/:id
PATCH /api/v1/users/:id
PATCH /api/v1/users/:id/status
```

## Hostel and Groups

``` text
POST  /api/v1/hostels
GET   /api/v1/hostels
POST  /api/v1/hostels/:id/floors
POST  /api/v1/hostels/:id/rooms

POST  /api/v1/laundry-groups
GET   /api/v1/laundry-groups
PATCH /api/v1/laundry-groups/:id
```

## Schedules

``` text
POST  /api/v1/schedules
GET   /api/v1/schedules
GET   /api/v1/schedules/today
GET   /api/v1/schedules/my
GET   /api/v1/schedules/upcoming
PATCH /api/v1/schedules/:id

POST  /api/v1/schedules/holidays
PATCH /api/v1/schedules/holidays/:id
```

## Laundry

``` text
POST  /api/v1/laundry/verify-submission
POST  /api/v1/laundry/submit
GET   /api/v1/laundry/my
GET   /api/v1/laundry/:id
GET   /api/v1/laundry/today/queue
PATCH /api/v1/laundry/:id/status
POST  /api/v1/laundry/:id/verify-pickup
```

## Complaints

``` text
POST  /api/v1/complaints
GET   /api/v1/complaints
GET   /api/v1/complaints/:id
PATCH /api/v1/complaints/:id/status
```

## Lost & Found

``` text
POST  /api/v1/lost-found
GET   /api/v1/lost-found
GET   /api/v1/lost-found/:id
POST  /api/v1/lost-found/:id/claim
PATCH /api/v1/lost-found/:id/claim
```

## Feedback

``` text
POST /api/v1/feedback
GET  /api/v1/feedback
GET  /api/v1/feedback/analytics
```

## Notifications

``` text
GET   /api/v1/notifications
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/read-all
```

## Reports

``` text
GET /api/v1/reports/dashboard
GET /api/v1/reports/laundry
GET /api/v1/reports/complaints
GET /api/v1/reports/feedback
```

## Health Check

``` text
GET /api/v1/healthcheck
```

------------------------------------------------------------------------

# 23. Database Schema

## users

``` text
id
name
email
passwordHash
role
studentId
employeeId
phone
hostelId
floorId
roomId
barcodeValue
status
createdAt
updatedAt
```

Roles:

``` text
student
staff
admin
```

------------------------------------------------------------------------

## hostels

``` text
id
name
code
status
createdAt
updatedAt
```

## floors

``` text
id
hostelId
floorNumber
name
createdAt
```

## rooms

``` text
id
floorId
roomNumber
status
createdAt
```

## laundry_groups

``` text
id
hostelId
name
groupOrder
roomRangeStart
roomRangeEnd
status
createdAt
updatedAt
```

## schedules

``` text
id
scheduleDate
groupId
startTime
endTime
status
rotationPosition
createdBy
createdAt
updatedAt
```

## holidays

``` text
id
date
reason
createdBy
createdAt
```

## laundry_records

``` text
id
studentId
scheduleId
submittedByStaffId
status
clothDetails
submittedAt
readyAt
deliveredAt
pickupVerifiedAt
createdAt
updatedAt
```

## complaints

``` text
id
studentId
laundryId
category
description
imageUrl
status
adminRemarks
resolvedBy
resolvedAt
createdAt
updatedAt
```

## lost_found

``` text
id
reportedByStaffId
title
description
category
color
imageUrl
foundDate
status
createdAt
updatedAt
```

## lost_found_claims

``` text
id
itemId
studentId
description
status
reviewedBy
reviewedAt
remarks
createdAt
updatedAt
```

## feedback

``` text
id
studentId
laundryId
cleanlinessRating
timelinessRating
staffServiceRating
overallRating
comment
createdAt
```

## notifications

``` text
id
userId
type
title
message
isRead
createdAt
```

------------------------------------------------------------------------

# 24. Database Relationships

``` text
Hostel
  ↓
Floor
  ↓
Room
  ↓
Student
  ↓
Laundry Group
  ↓
Schedule
  ↓
Laundry Record
```

Other relationships:

``` text
Student → Complaints
Student → Feedback
Student → Notifications
Student → Lost & Found Claims

Staff → Laundry Records
Staff → Lost & Found Items

Admin → Users
Admin → Schedules
Admin → Complaints
Admin → Lost & Found Claims
```

Use foreign keys and database constraints wherever appropriate.

------------------------------------------------------------------------

# 25. Drizzle ORM Requirements

Use Drizzle ORM for normal database operations.

Required files:

``` text
schema.js
relations.js
db.js
seed.js
```

Use Drizzle migrations for schema changes.

Use transactions for critical operations such as:

-   Laundry submission.
-   Laundry delivery.
-   Schedule generation.
-   Lost & Found claim approval.

------------------------------------------------------------------------

# 26. Critical Laundry Submission Transaction

The backend should perform:

``` text
BEGIN
 ↓
Authenticate staff
 ↓
Find student by QR/barcode
 ↓
Check active student
 ↓
Find student's group
 ↓
Find today's schedule
 ↓
Check group match
 ↓
Check duplicate submission
 ↓
Create laundry record
 ↓
Create notification
 ↓
COMMIT
```

If a critical operation fails:

``` text
ROLLBACK
```

------------------------------------------------------------------------

# 27. Duplicate Submission Rule

A student should not be able to have two active submissions for the same
schedule/day.

Before creating a laundry record:

``` text
Find existing active laundry record
        ↓
Exists?
   /           YES           NO
 ↓             ↓
Reject        Create
```

This prevents accidental duplicate records.

------------------------------------------------------------------------

# 28. Status Transition Rules

Allowed:

``` text
received → ready_for_pickup
ready_for_pickup → delivered
```

Disallowed:

``` text
delivered → received
delivered → ready_for_pickup
```

The backend must validate the current status before every update.

------------------------------------------------------------------------

# 29. API Validation and Error Handling

Use Zod or equivalent validation.

Validate:

-   Email.
-   Student ID.
-   Employee ID.
-   Phone.
-   Room number.
-   Schedule date.
-   Time.
-   Ratings.
-   Complaint fields.
-   Status values.
-   IDs.
-   Uploaded file metadata.

Example success response:

``` json
{
  "success": true,
  "message": "Laundry submitted successfully",
  "data": {}
}
```

Example error:

``` json
{
  "success": false,
  "message": "Student is not scheduled for laundry today"
}
```

Common HTTP codes:

``` text
400 → Bad Request
401 → Unauthorized
403 → Forbidden
404 → Not Found
409 → Conflict
422 → Validation Error
500 → Internal Server Error
```

------------------------------------------------------------------------

# 30. Security Requirements

The backend must implement:

-   JWT authentication.
-   Role-based authorization.
-   bcryptjs password hashing.
-   HTTP-only refresh cookies.
-   Input validation.
-   CORS configuration.
-   Secure environment variables.
-   Database constraints.
-   Protected staff/admin routes.
-   File upload validation.
-   Rate limiting for authentication where appropriate.
-   Safe error responses.

Sensitive credentials must be stored in `.env` and never committed to
Git.

Example:

``` text
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
COOKIE_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

------------------------------------------------------------------------

# 31. File and Image Management

Complaint images and Lost & Found images can be stored using Cloudinary
or another dedicated storage provider.

The database should store:

``` text
imageUrl
```

The backend should validate:

-   File type.
-   File size.
-   Upload authorization.

------------------------------------------------------------------------

# 32. Non-Functional Requirements

## Performance

The system should support high concurrent usage during laundry periods.

Indexes should be added to frequently queried fields such as:

``` text
users.email
users.studentId
users.barcodeValue
schedules.scheduleDate
laundry_records.studentId
laundry_records.status
complaints.studentId
notifications.userId
```

## Reliability

Laundry records must not be lost during critical operations.

## Scalability

The system should support approximately 3,000 students and allow future
expansion to additional blocks or laundry centers.

## Maintainability

Use modular controllers/services, centralized validation, centralized
error handling, and clear database relations.

------------------------------------------------------------------------

# 33. Development Seed Data

Development should include:

``` text
Admin:
admin@vwash.com

Staff:
staff@vwash.com

Student:
student@vwash.com
```

Development passwords should only be used locally and must not be used
in production.

Seed data should also contain sample:

-   Hostel.
-   Floors.
-   Rooms.
-   Laundry groups.
-   Schedule.
-   Students.
-   QR/barcode identifiers.

------------------------------------------------------------------------

# 34. Testing Requirements

## Authentication

-   Valid login.
-   Invalid password.
-   Inactive account.
-   Expired access token.
-   Refresh token.
-   Logout.

## Authorization

-   Student accessing Admin endpoint.
-   Staff accessing Admin endpoint.
-   Student accessing another student's data.
-   Admin accessing permitted operations.

## Scheduling

-   Normal rotation.
-   Rotation from final group back to first.
-   One holiday.
-   Multiple consecutive holidays.
-   Student schedule lookup.
-   Cancelled schedule.

## Laundry

-   Valid QR/barcode.
-   Invalid QR/barcode.
-   Correct-day submission.
-   Wrong-day submission.
-   Duplicate submission.
-   Inactive student.
-   Status update.
-   Invalid status transition.
-   Valid pickup.
-   Already delivered pickup.

## Complaints

-   Create complaint.
-   View own complaint.
-   Admin update.
-   Unauthorized update.

## Lost & Found

-   Staff uploads item.
-   Student submits claim.
-   Admin approves claim.
-   Admin rejects claim.
-   Returned item handling.

## Feedback

-   Valid feedback.
-   Invalid rating.
-   Unauthorized access.
-   Admin analytics.

------------------------------------------------------------------------

# 35. Backend Implementation Order

### Phase 1 -- Foundation

-   Express application.
-   PostgreSQL connection.
-   Drizzle ORM.
-   Schema.
-   Migrations.
-   Environment configuration.
-   Error handling.
-   Validation.

### Phase 2 -- Authentication

-   Login.
-   Access token.
-   Refresh token.
-   Logout.
-   `/me`.
-   Auth middleware.
-   Role middleware.
-   bcryptjs.

### Phase 3 -- Users and Hostel

-   Student management.
-   Staff management.
-   Hostel blocks.
-   Floors.
-   Rooms.
-   Laundry groups.

### Phase 4 -- Scheduling

-   Rotation configuration.
-   Schedule generation.
-   Holiday handling.
-   Student schedule lookup.
-   Today's schedule.
-   Upcoming schedule.

### Phase 5 -- Laundry

-   QR/barcode verification.
-   Schedule eligibility.
-   Laundry submission.
-   Queue.
-   Status updates.
-   Pickup verification.
-   Delivery.

### Phase 6 -- Supporting Modules

-   Complaints.
-   Lost & Found.
-   Feedback.
-   Notifications.

### Phase 7 -- Admin and Reports

-   Dashboard.
-   Reports.
-   Analytics.
-   Operational monitoring.

### Phase 8 -- Testing and Integration

-   Unit testing.
-   API testing.
-   Role testing.
-   Scheduling edge cases.
-   End-to-end testing.
-   Frontend-backend integration.

------------------------------------------------------------------------

# 36. Final Business Rules

The following rules are mandatory:

1.  Only Admin can create Staff accounts.
2.  Only Admin can configure the laundry rotation.
3.  Students cannot freely select arbitrary laundry dates.
4.  Students are associated with a laundry group through their
    hostel/room structure.
5.  Only the group assigned to the current working day can submit
    laundry.
6.  Holidays do not advance the rotation.
7.  Multiple consecutive holidays also do not advance the rotation.
8.  A student cannot submit duplicate laundry for the same schedule.
9.  QR/barcode identifies the student; the backend performs the actual
    verification.
10. Laundry status must follow
    `Received → Ready to Pick Up → Delivered`.
11. Delivered laundry cannot be delivered again.
12. Pickup must verify the correct student before delivery.
13. Students can only access their own laundry and complaints.
14. Staff can perform operational laundry actions but cannot perform
    unrestricted administrative actions.
15. Only Admin can resolve complaints.
16. Only Admin can approve/reject Lost & Found claims.
17. Inactive users cannot log in.
18. Backend authorization must never depend only on frontend checks.
19. Sensitive credentials must never be returned in normal API
    responses.
20. Critical database operations should use transactions.
21. Already completed schedules should not be silently modified.
22. The backend is the source of truth for schedule eligibility, laundry
    ownership, status transitions, and permissions.

------------------------------------------------------------------------

# 37. Overall System Flow

``` text
                         ADMIN
                           │
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
       Users          Hostel/Groups     Rotation
                                            │
                                            ↓
                                     Daily Schedule
                                            │
                    ┌───────────────────────┴──────────────────┐
                    │                                          │
                 STUDENT                                     STAFF
                    │                                          │
              View Schedule                              View Queue
                    │                                          │
              Arrive on Date                             Scan QR/Barcode
                    │                                          │
                    └──────────────────→ BACKEND ←──────────────┘
                                            │
                                    Verify Student
                                            │
                                    Check Today's Group
                                            │
                                      ┌─────┴─────┐
                                      │           │
                                    MATCH      NO MATCH
                                      │           │
                                      ↓           ↓
                              Accept Laundry    Reject
                                      │
                                  RECEIVED
                                      │
                                      ↓
                              Process Laundry
                                      │
                                      ↓
                              READY FOR PICKUP
                                      │
                                      ↓
                                Scan Student
                                      │
                                Verify Owner
                                      │
                                      ↓
                                  DELIVERED
                                      │
                                      ↓
                                  FEEDBACK
```

------------------------------------------------------------------------

# 38. Definition of Done

The backend will be considered functionally complete when:

-   Authentication works for all three roles.
-   Access and refresh tokens work correctly.
-   Role-based authorization prevents unauthorized access.
-   Admin can create/manage students and staff.
-   Hostel blocks, floors, rooms, and laundry groups can be configured.
-   Round-robin schedules can be generated.
-   Holidays correctly pause the rotation.
-   Students can see their assigned dates.
-   Staff can scan QR/barcodes.
-   The backend can determine whether the student is scheduled today.
-   Valid laundry submissions create records.
-   Duplicate submissions are prevented.
-   Laundry moves through all three statuses.
-   Pickup verification prevents wrong delivery.
-   Complaints work end-to-end.
-   Lost & Found works end-to-end.
-   Feedback works.
-   Notifications work for important events.
-   Admin reports provide useful operational information.
-   Database relationships and transactions maintain consistency.
-   API validation and error handling are implemented.
-   The system passes role, schedule, holiday, laundry, and pickup test
    cases.

------------------------------------------------------------------------

# 39. Final Product Principle

V-Wash should not be implemented as a simple laundry booking
application.

It should model the actual hostel laundry operation:

``` text
3,000 Students
      ↓
Hostel / Floor / Room
      ↓
Laundry Groups
      ↓
Round-Robin Working-Day Rotation
      ↓
QR/Barcode Verification
      ↓
Laundry Submission
      ↓
Received
      ↓
Ready to Pick Up
      ↓
Delivered
```

The main objective is to make the existing manual hostel process
**digital, traceable, fair, and manageable at large scale**, while
keeping Admin responsible for scheduling and Staff responsible for
day-to-day laundry operations.
