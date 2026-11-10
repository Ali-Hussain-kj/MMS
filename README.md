# Madaris Management System (MMS)

React Native CLI app built with JSX and Firebase. It includes role-based login, Firestore-backed student enrollment and approvals, teacher attendance/progress reports, parent monitoring, and admin hostel management.

## Live records

There are no preview dashboards or placeholder students in the app. Sign in with an authenticated admin or teacher account to view Firestore student records. Parent enrollment requests are saved to Firestore and remain available to an admin across devices and app restarts.

## Recommended feature structure

The starter currently has a dashboard, localization strings, and Firebase setup. Add the feature folders below as those modules are implemented:

```text
App.jsx
Src/
  features/
    dashboard/             Dashboard screen and module overview
    students/              Student records and admissions
    teachers/               Teacher and staff profiles
    attendance/              Student and staff attendance
    quranProgress/           Hifz, Sabaq, Sabaqi, Manzil, and Nazra
    darsENizami/             Kitab-wise progress and Takrar
    school/                  Asri Taleem classes and results
    admin/                   Admin workflows, including hostel management
    fees/                    Student fee records
    donations/               Donors, Zakat, and Sadaqat
    salaries/                Staff salary and payments
    reports/                 Academic and financial reports
    parentPortal/            Parent-facing progress
  components/                Shared UI components
  localization/              English and Urdu strings
  navigation/                App navigation
  services/firebase/         Firebase setup and data services
  theme/                     Shared colors, spacing, and typography
```

Keep each feature self-contained as it is implemented, for example:

```text
Src/features/students/
  screens/
  components/
  services/
  studentFields.js
```

## Firebase setup

1. Create a Firebase project and register the Android app using the package name in `android/app/build.gradle`.
2. Download `google-services.json` and place it at `android/app/google-services.json`. It must contain the same Android package name as the app's `applicationId`.
3. The Google Services Gradle plugin is configured in the Android Gradle files. The app currently uses the Firebase JavaScript SDK, so it does not add duplicate native Firebase Auth/Firestore dependencies or an unused native Analytics SDK.
4. In Firebase Console, create a Cloud Firestore database and enable the Firebase Authentication sign-in methods the app will use. If a Firestore connectivity check reports that `firestore.googleapis.com` is disabled or has not been used, enable the Cloud Firestore API for the same Google Cloud project and retry after the change propagates.
5. Copy the Firebase **web app configuration** into `Src/services/firebase/firebaseConfig.js`.
6. Call `getFirebaseServices()` from a feature service to access the JavaScript SDK's `auth` and `db`. It throws a clear error until the config placeholders have been replaced.
7. Publish the rules in `firestore.rules` to the same Firebase project before using the parent portal or real student data. The mobile app cannot deploy or bypass these rules.
8. Provision the first administrator and each teacher in Firebase Authentication. In Firestore, create `users/{uid}` with the matching trusted `role`. For teachers, set `studentIds` to the student document IDs they may access and `assignedClasses` to the class strings they may teach (for example `["1", "2"]`). Empty or missing assignments grant no student/report or class-catalog access. Set roles and assignments only through a trusted administrator or Firebase Console; users cannot assign themselves permissions.

The app opens on Parent Login when signed out. Staff choose Admin or Teacher from **Staff Login**; both Main Admin and Hostel Admin share the Admin Login, and the dashboard is chosen only from the verified `users/{uid}.role` profile. Teacher and parent logins likewise require matching Firestore roles. Persisted sessions are revalidated on launch, and logout returns to Parent Login.

## Hostel management

Parents who select hostel accommodation during enrollment create a pending hostel admission request alongside the normal student enrollment. After the Main Admin approves the student and the Hostel Admin approves the hostel request, the Hostel Admin allocates a room and bed. The Hostel Admin dashboard includes a **Registered Students** view with search and floor filtering, plus request review, room management, attendance, meals, and visitor records. Parents can request cancellation, which does not release the bed until the Hostel Admin approves it. Rooms include a bed count so occupancy can be tracked; room/bed allocations are checked transactionally to prevent duplicate assignments. Hostel records are stored in the existing `hostelRooms`, `hostelRegistrations`, `hostelRequests`, `hostelActiveRequests`, `hostelStudentRoster`, `hostelMeals`, and `hostelVisitors` Firestore collections. Publish the current `firestore.rules` to enable access; these collections are restricted to authenticated admin profiles.

## Parent monitoring

Parents enter their email and choose a password as part of the student enrollment form; there is no separate parent-account registration step. The app creates the Firebase Auth account, sends an email verification link, and saves the enrollment request to the `registrationRequests` collection. The password is never written to Firestore. An authenticated admin reviews the request in **Admin → Requests**. Approval creates the student document, creates or updates the parent's `users/{uid}` profile, links the student, and removes the request in one Firestore transaction. After email verification, the parent can sign in and monitor the approved child. The same parent login can be used when enrolling additional children.

Parent links are stored on `users/{parentUid}.studentIds`. Student records live at `students/{studentId}`; teacher reports are in the `attendance`, `hifzProgress`, `nazraProgress`, `darsProgress`, `takrarAttendance`, and `schoolResults` subcollections. Class subject lists are shared in `schoolSubjects/{className}`. The teacher dashboard loads saved reports for the selected student and only confirms changes after Firestore writes succeed. Firestore rules restrict report access to teachers/admins and linked parents, and class-subject writes to teachers/admins.

Teacher profile records are stored in the admin-only `teachers` collection. These records do not create Firebase Authentication users or grant the teacher role; an administrator must separately provision the account and its `users/{uid}` role through a trusted process. Fee, Zakat, Sadaqat, donation, and salary entries use the admin-only `financialRecords` collection. Each record links fees to a student and salary to a teacher, stores an amount and date, and supports monthly income/salary summaries. The app does not assume a currency; configure the reporting convention used by your institution before relying on totals.

The admin and teacher role profiles must be provisioned by a trusted operator. Firebase Security Rules have not been deployed automatically by this app; publish the current `firestore.rules` in Firebase Console before using real parent or student data. Enrollment requests made with an older app version were only held in memory; submit them again using the same parent login after updating the app, or add/link the student through a real authenticated admin account.

Firebase Auth persistence uses AsyncStorage. The JavaScript Firebase SDK is initialized lazily so the app can run before its web config is filled in. If the project later adopts native Firebase products, add their Android dependencies through the Firebase BoM; that native setup is separate from the JavaScript Auth/Firestore setup.

## Run the app

```sh
npm install
npm start
npm run android
```

The language toggle uses the English and Urdu dictionaries in `Src/localization/`. Role selection, parent registration, and the admin/teacher dashboard headers and navigation labels are localized. Some detailed dashboard copy remains English. Urdu right-to-left layout has not yet been configured.
