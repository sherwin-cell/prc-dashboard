# Blood-Connect PRC Admin Portal

Web portal for the Philippine Red Cross – Sorsogon Chapter to run
Blood-Connect: review blood requests and donor offers, manage donor
applications (appointments, screening, activation, availability), review
users' identity verification, and chat with app users.

Part of the Blood-Connect system:

| Repository | Role |
|---|---|
| `blood_connect` | Flutter mobile app; also holds `firestore.rules` and `firestore.indexes.json` |
| `blood_connect_backend` | FastAPI API and notification worker (private files, face verification, account deletion, PRC stock notices) |
| `blood-connect-admin` | This portal (React 19, Vite, Tailwind CSS, Firebase Auth + Firestore) |

## Requirements

- Node.js 20.19+ or 22.12+ (required by Vite 8) and npm
- Access to the Blood-Connect Firebase project
- `blood_connect_backend` running, for the features that call it (below)

## Installation

```bash
git clone https://github.com/sherwin-cell/prc-dashboard.git blood-connect-admin
cd blood-connect-admin
npm ci
```

## Configuration

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Firebase console > Project settings > Your apps > the web app's config |
| `VITE_API_BASE_URL` | URL of `blood_connect_backend`. Optional for `npm run dev` (defaults to `http://127.0.0.1:8000`); **required for production builds**. |

Notes:

- `.env` is git-ignored: never commit it. Only variables prefixed with
  `VITE_` reach the browser, and everything in them is public once the portal
  is built, so never put secrets (service account keys, API secrets) here.
  Data is protected by Firebase Auth and `firestore.rules`, not by hiding
  the web config.
- Vite reads `.env` at startup: restart `npm run dev` after changing it, and
  rebuild after changing it for production.
- The backend must allow this portal's origin in its `ADMIN_CORS_ORIGINS`
  setting (it allows `http://localhost:5173` and `http://127.0.0.1:5173` by
  default).

## Admin access

Only PRC administrators can sign in. An account is an administrator when its
Firebase ID token has the custom claim `admin: true`, or its
`users/{uid}` document has `role: "admin"` (the same test as `isAdmin()` in
`firestore.rules`). Any other account is signed out again. To make an
administrator, create the account in Firebase Authentication, then set
`role` to `"admin"` on its `users/{uid}` document in the Firebase console.

## Development

```bash
npm run dev       # start the dev server at http://localhost:5173
npm run lint      # ESLint
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

Run the backend alongside the portal for the features that use it:

```bash
# in blood_connect_backend
uvicorn main:app --reload --env-file .env
```

| Feature | Needs the backend |
|---|---|
| Viewing ID photos and Blood Request Forms (private files) | Yes: `GET /api/files/view`, `/api/files/content` |
| Deleting a user account | Yes: `DELETE /api/admin/users/{uid}` |
| PRC stock notices on a request | Yes: `POST /api/admin/requests/{id}/prc-stock` |
| Requests, offers, donors, users, chat | No: read and written directly in Firestore |

Notifications to app users (request approved, donor confirmed, and so on) are
sent by the backend's notification worker when the portal changes Firestore,
so keep the worker running for them to go out.

## Project structure

```
src/
  components/   shared UI (offer list, secure file viewer, spinners)
  constants/    status values shared with the app and backend
  context/      auth context (admin sign-in check)
  features/     pages: dashboard, requests, donors, users, chat, announcements
  firebase/     Firebase initialisation
  hooks/        data hooks
  layouts/      admin shell
  pages/        archive pages
  routes/       routing and the protected route
  services/     Firestore services and the backend API client
```

Announcements are still under development: their routes show an
"Under development" page.

## Security rules

The portal relies on the Firestore security rules in the `blood_connect`
repository (`firestore.rules`). Change and deploy rules from there:

```bash
# in blood_connect
firebase deploy --only firestore:rules
```

## Continuous integration

`.github/workflows/ci.yml` runs `npm ci`, `npm run lint` and `npm run build`
on every push and pull request. The build uses placeholder values, not real
configuration.
