# Campus Event Hub

Campus Event Hub is an HTML/CSS/JavaScript frontend served by an Express API. Accounts, sessions, events, registrations, and student feedback are stored in SQLite using Node's built-in `node:sqlite` module.

Seeded events use a 60-minute duration. Organizers can set a duration from 15 minutes to 24 hours; their dashboard warns before submitting overlapping events on the same date.

## Requirements

- Node.js 22.13 or newer (Node.js 24 is recommended)
- npm

## Run the application

From the project root, install the backend packages:

```powershell
npm.cmd install
```

Then start the complete app from the project root:

```powershell
npm.cmd start
```

Open [http://localhost:3000](http://localhost:3000). Express serves both the website and API, so the frontend and backend use the same origin. The database is created and seeded automatically at `backend/data/campus-events.sqlite` the first time the server starts. Keep the terminal open while using the app; press `Ctrl+C` to stop it.

To run in development mode with automatic server restarts:

```powershell
npm.cmd run dev
```

To run backend tests:

```powershell
npm.cmd test
```

Optional environment variables:

- `PORT` changes the HTTP port (default `3000`).
- `DB_PATH` changes the SQLite database file path.
- `ADMIN_SIGNUP_KEY` enables registration of additional administrator accounts. Keep it private; do not commit it or share it with students.
- `CORS_ORIGINS` is a comma-separated allowlist for a separately hosted frontend. Localhost ports `3000` and `5500` are allowed by default. When using VS Code Live Server on port `5500`, the frontend automatically calls the API on port `3000`; for another frontend/API setup, set `window.CAMPUS_EVENT_API_URL` before loading `JS/api.js` and configure `CORS_ORIGINS`.

The first administrator can sign up when the database has no admin accounts. Create that account locally before exposing the app publicly. To allow additional administrators, set a private key in PowerShell before starting the server:

```powershell
$env:ADMIN_SIGNUP_KEY = "use-a-long-private-value"
npm.cmd start
```

## Accounts and portals

- **Students** can create an account, browse events, register under their account identity, see their registrations and QR attendance tickets, and submit or track feedback and complaints (including administrator responses).
- **Organizers** can create and manage only the events they submitted, review their event's registrations, and verify attendance by scanning a QR code or entering the ticket code. New submissions require administrator approval before appearing publicly.
- **Administrators** can review event submissions and feedback, update feedback status, respond to student complaints, and view platform registrations.
- The homepage embeds the **GEHU Bhimtal 3D Campus Radar** directly in its Smart Features section and provides a full-view page at `Pages/campus-3d.html`. It loads approved events from the API and shows approximate interactive venue pins on an illustrative 3D hillside campus. The existing 2D radar page remains unchanged. The model uses a GEHU Bhimtal campus photo by Ravi Dwivedi, licensed CC BY-SA 4.0, with attribution on both pages; 3D rendering uses Three.js r128 from cdnjs (MIT license).
- Sign up or log in from the homepage. The app opens the portal assigned to the account; portal pages and their API routes enforce the role on the server.
- Passwords are stored as salted scrypt hashes. Login sessions use opaque bearer tokens whose hashes are stored in SQLite and expire after seven days (30 days when “Remember me” is selected). Logging out revokes the active token.
- The first administrator can bootstrap a fresh database. Any additional administrator registration requires `ADMIN_SIGNUP_KEY`; configure it securely and do not expose it to non-administrators.

Use HTTPS and appropriate operational controls before deploying publicly. Bootstrap the first admin before public deployment; additional admin signup relies on the secrecy of `ADMIN_SIGNUP_KEY`, configured in the hosting environment rather than source control.

## API

Endpoints are available under `/api` (and without the prefix for simple direct API use):

- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `GET /events` — approved events; optional `search`, `category`, `venue`, and `date` query parameters
- `GET /events/:id` — approved event details
- `POST /events/:id/register`, `GET /my-registrations` — student account required
- `GET /organizer/events`, `POST /organizer/events`, `PUT /organizer/events/:id`, `DELETE /organizer/events/:id` — organizer account required; scoped to the organizer's own events
- `GET /organizer/events/:id/registrations`, `GET /organizer/stats`
- `POST /organizer/events/:id/check-in` — verify and record a registration's attendance; limited to the event's organizer
- `POST /feedback`, `GET /my-feedback` — authenticated account required
- `GET /admin/events`, `GET /admin/stats`, `GET /admin/registrations`, `GET /admin/feedback` — administrator account required
- `PATCH /admin/events/:id/status` — set `pending`, `approved`, or `rejected`
- `PATCH /admin/feedback/:id/status` — set `Submitted`, `Under Review`, `Resolved`, or `Closed`
- `PATCH /admin/feedback/:id/response` — save an administrator response visible in the submitter's feedback history
- `GET /health` — API and database health check
