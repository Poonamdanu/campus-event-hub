const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");
const { createApp } = require("../server");

test("first admin can bootstrap an unconfigured database exactly once", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "campus-admin-bootstrap-"));
    const app = createApp({ databasePath: path.join(directory, "bootstrap.sqlite") });
    const server = app.listen(0);
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const signup = details => fetch(baseUrl + "/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details)
    });

    t.after(async () => {
        server.close();
        await once(server, "close");
        app.locals.database.close();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    const firstResponse = await signup({
        name: "Initial Administrator",
        email: "initial.admin@example.edu",
        password: "admin-password",
        role: "admin"
    });
    assert.equal(firstResponse.status, 201);

    const secondResponse = await signup({
        name: "Unexpected Administrator",
        email: "second.admin@example.edu",
        password: "admin-password",
        role: "admin"
    });
    assert.equal(secondResponse.status, 403);
    assert.match((await secondResponse.json()).error, /ADMIN_SIGNUP_KEY/);
});

test("existing registrations and feedback are migrated without losing records", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "campus-event-migration-"));
    const databasePath = path.join(directory, "legacy.sqlite");
    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            college TEXT NOT NULL DEFAULT '',
            college_id TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            venue TEXT NOT NULL,
            description TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            organizer TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'approved',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            email TEXT NOT NULL COLLATE NOCASE,
            registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(event_id, email)
        );
        CREATE TABLE feedback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            event_name TEXT NOT NULL DEFAULT '',
            rating INTEGER,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Submitted',
            submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users (id, name, email, password_hash, role)
            VALUES ('legacy-student', 'Legacy Student', 'legacy@example.edu', 'hash', 'student');
        INSERT INTO events (id, title, category, date, time, venue, description, capacity, organizer)
            VALUES ('legacy-event', 'Legacy Event', 'Workshop', '2026-12-01', '10:00',
                'Lab', 'Existing event', 10, 'Organizer');
        INSERT INTO registrations (event_id, name, email)
            VALUES ('legacy-event', 'Legacy Student', 'legacy@example.edu');
        INSERT INTO feedback (id, user_id, type, message)
            VALUES ('legacy-feedback', 'legacy-student', 'Complaint', 'Existing complaint');
    `);
    legacyDatabase.close();

    const app = createApp({ databasePath });
    t.after(() => {
        app.locals.database.close();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    const registration = app.locals.database.prepare(`
        SELECT attendance_code AS attendanceCode, attended_at AS attendedAt
        FROM registrations WHERE event_id = 'legacy-event'
    `).get();
    assert.ok(registration.attendanceCode);
    assert.equal(registration.attendedAt, null);
    assert.equal(app.locals.database.prepare(`
        SELECT admin_response AS adminResponse
        FROM feedback WHERE id = 'legacy-feedback'
    `).get().adminResponse, "");
});

test("authenticated role portals, event workflows, and feedback persist", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "campus-event-hub-"));
    const databasePath = path.join(directory, "test.sqlite");
    const adminSignupKey = "test-admin-setup-key";
    let app = createApp({ databasePath, adminSignupKey });
    let server = app.listen(0);
    await once(server, "listening");
    let baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const request = (route, options = {}) => fetch(baseUrl + route, options);
    const jsonRequest = (route, body, token, method = "POST") => request(route, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
    });

    t.after(async () => {
        if (server.listening) {
            server.close();
            await once(server, "close");
        }
        app.locals.database.close();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    const origin = `http://127.0.0.1:${server.address().port}`;
    const homePageResponse = await fetch(origin + "/");
    assert.equal(homePageResponse.status, 200);
    assert.match(await homePageResponse.text(), /Campus Event Hub|Eventora/);

    for (const assetPath of [
        "/CSS/style.css",
        "/JS/script.js",
        "/Pages/events.html",
        "/Pages/portal.html",
        "/Pages/radar.html"
    ]) {
        const assetResponse = await fetch(origin + assetPath);
        assert.equal(assetResponse.status, 200, `${assetPath} should be served`);
    }
    assert.equal((await fetch(origin + "/backend/server.js")).status, 404);
    assert.equal((await fetch(origin + "/Backend/server.js")).status, 404);
    assert.equal((await fetch(origin + "/Pages/%2e%2e/backend/server.js")).status, 404);
    assert.equal((await fetch(origin + "/backend/data/campus-events.sqlite")).status, 404);

    const healthResponse = await request("/health");
    assert.deepEqual(await healthResponse.json(), { status: "ok", database: "connected" });
    const seededResponse = await request("/events");
    assert.equal((await seededResponse.json()).length, 6);

    assert.equal((await request("/organizer/events")).status, 401);
    assert.equal((await request("/admin/events")).status, 401);
    assert.equal((await jsonRequest("/feedback", {
        type: "Complaint",
        message: "Unauthorized submission."
    })).status, 401);
    assert.equal((await jsonRequest("/auth/signup", {
        name: "Unkeyed Admin",
        email: "unkeyed.admin@example.edu",
        password: "admin-password",
        role: "admin"
    })).status, 403);

    const signup = async (details) => {
        const response = await jsonRequest("/auth/signup", details);
        assert.equal(response.status, 201);
        return response.json();
    };
    const student = await signup({
        name: "Demo Student",
        email: "student@example.edu",
        password: "student-password",
        role: "student",
        college: "Campus University",
        collegeId: "S-001"
    });
    const secondStudent = await signup({
        name: "Another Student",
        email: "other@example.edu",
        password: "student-password",
        role: "student",
        college: "Campus University",
        collegeId: "S-002"
    });
    const rememberedLoginResponse = await jsonRequest("/auth/login", {
        email: "student@example.edu",
        password: "student-password",
        rememberMe: true
    });
    assert.equal(rememberedLoginResponse.status, 200);
    const rememberedLogin = await rememberedLoginResponse.json();
    const rememberedDays = (new Date(rememberedLogin.expiresAt) - Date.now()) /
        (24 * 60 * 60 * 1000);
    assert.ok(rememberedDays > 29 && rememberedDays <= 30);
    const organizer = await signup({
        name: "Campus Organizer",
        email: "organizer@example.edu",
        password: "organizer-password",
        role: "organizer",
        college: "Campus University",
        collegeId: "O-001"
    });
    const otherOrganizer = await signup({
        name: "Other Organizer",
        email: "other.organizer@example.edu",
        password: "organizer-password",
        role: "organizer",
        college: "Campus University",
        collegeId: "O-002"
    });
    const admin = await signup({
        name: "Campus Admin",
        email: "admin@example.edu",
        password: "admin-password",
        role: "admin",
        adminKey: adminSignupKey
    });

    assert.equal((await request("/admin/events", {
        headers: { Authorization: `Bearer ${student.token}` }
    })).status, 403);
    assert.equal((await request("/organizer/events", {
        headers: { Authorization: `Bearer ${admin.token}` }
    })).status, 403);
    assert.equal((await jsonRequest("/auth/login", {
        email: "student@example.edu",
        password: "wrong-password"
    })).status, 401);

    const invalidEvent = await jsonRequest("/organizer/events", {
        title: "Missing required event fields"
    }, organizer.token);
    assert.equal(invalidEvent.status, 400);

    const createResponse = await jsonRequest("/organizer/events", {
        title: "Small Demo Workshop",
        category: "Workshop",
        date: "2026-12-01",
        time: "14:00",
        venue: "Lab 1",
        description: "A test event.",
        capacity: 1
    }, organizer.token);
    assert.equal(createResponse.status, 201);
    const createdEvent = await createResponse.json();
    assert.equal(createdEvent.status, "pending");
    const otherOrganizerEvents = await request("/organizer/events", {
        headers: { Authorization: `Bearer ${otherOrganizer.token}` }
    }).then(response => response.json());
    assert.equal(otherOrganizerEvents.length, 0);

    const organizerTestEventResponse = await jsonRequest("/organizer/events", {
        title: "Organizer Ownership Test",
        category: "Workshop",
        date: "2026-12-02",
        time: "15:00",
        venue: "Lab 2",
        description: "Verify organizer ownership for edits and deletion.",
        capacity: 5,
        durationMinutes: 90
    }, organizer.token);
    const organizerTestEvent = await organizerTestEventResponse.json();
    assert.equal(organizerTestEventResponse.status, 201);
    assert.equal(organizerTestEvent.durationMinutes, 90);
    const otherOrganizerHeaders = { Authorization: `Bearer ${otherOrganizer.token}` };
    assert.equal((await request(
        `/organizer/events/${organizerTestEvent.id}/registrations`,
        { headers: otherOrganizerHeaders }
    )).status, 404);
    assert.equal((await jsonRequest(
        `/organizer/events/${organizerTestEvent.id}`,
        {
            title: "Unauthorized edit",
            category: "Workshop",
            date: "2026-12-02",
            time: "15:00",
            venue: "Lab 2",
            description: "Unauthorized update.",
            capacity: 5
        },
        otherOrganizer.token,
        "PUT"
    )).status, 404);
    const ownerUpdateResponse = await jsonRequest(
        `/organizer/events/${organizerTestEvent.id}`,
        {
            title: "Organizer Ownership Updated",
            category: "Workshop",
            date: "2026-12-02",
            time: "15:00",
            venue: "Lab 2",
            description: "Ownership update succeeds.",
            capacity: 5
        },
        organizer.token,
        "PUT"
    );
    assert.equal(ownerUpdateResponse.status, 200);
    assert.equal((await ownerUpdateResponse.json()).status, "pending");
    assert.equal((await jsonRequest(
        `/organizer/events/${organizerTestEvent.id}`,
        {},
        otherOrganizer.token,
        "DELETE"
    )).status, 404);
    assert.equal((await request(`/organizer/events/${organizerTestEvent.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${organizer.token}` }
    })).status, 204);

    const passwordHash = app.locals.database.prepare(
        "SELECT password_hash FROM users WHERE email = ?"
    ).get("student@example.edu").password_hash;
    const storedSessionToken = app.locals.database.prepare(
        "SELECT token_hash FROM sessions WHERE user_id = ?"
    ).get(student.user.id).token_hash;
    assert.notEqual(passwordHash, "student-password");
    assert.notEqual(storedSessionToken, student.token);

    const hiddenResponse = await request(`/events/${createdEvent.id}`);
    assert.equal(hiddenResponse.status, 404);
    const approvalResponse = await jsonRequest(
        `/admin/events/${createdEvent.id}/status`,
        { status: "approved" },
        admin.token,
        "PATCH"
    );
    assert.equal(approvalResponse.status, 200);

    const registrationResponse = await jsonRequest(
        `/events/${createdEvent.id}/register`,
        {},
        student.token
    );
    assert.equal(registrationResponse.status, 201);
    const registration = await registrationResponse.json();
    assert.equal(registration.email, "student@example.edu");
    assert.equal(registration.attendanceCode.length >= 40, true);
    assert.match(registration.qrCode, /^data:image\/png;base64,/);

    assert.equal((await jsonRequest(
        `/organizer/events/${createdEvent.id}/check-in`,
        { code: registration.attendanceCode },
        otherOrganizer.token
    )).status, 404);
    assert.equal((await jsonRequest(
        `/organizer/events/${createdEvent.id}/check-in`,
        { code: "invalid-ticket-code" },
        organizer.token
    )).status, 404);
    const checkInResponse = await jsonRequest(
        `/organizer/events/${createdEvent.id}/check-in`,
        { code: registration.attendanceCode },
        organizer.token
    );
    assert.equal(checkInResponse.status, 200);
    assert.equal((await checkInResponse.json()).name, "Demo Student");
    assert.equal((await jsonRequest(
        `/organizer/events/${createdEvent.id}/check-in`,
        { code: registration.attendanceCode },
        organizer.token
    )).status, 409);

    const duplicateResponse = await jsonRequest(
        `/events/${createdEvent.id}/register`,
        {},
        student.token
    );
    assert.equal(duplicateResponse.status, 409);

    const capacityResponse = await jsonRequest(
        `/events/${createdEvent.id}/register`,
        {},
        secondStudent.token
    );
    assert.equal(capacityResponse.status, 409);

    const feedbackResponse = await jsonRequest("/feedback", {
        type: "Complaint",
        eventName: "Small Demo Workshop",
        rating: 2,
        message: "The venue information needs to be updated."
    }, student.token);
    assert.equal(feedbackResponse.status, 201);
    const feedback = await feedbackResponse.json();
    assert.equal(feedback.status, "Submitted");
    assert.equal((await request("/admin/feedback", {
        headers: { Authorization: `Bearer ${admin.token}` }
    }).then(response => response.json())).length, 1);
    assert.equal((await jsonRequest(
        `/admin/feedback/${feedback.id}/status`,
        { status: "Under Review" },
        admin.token,
        "PATCH"
    )).status, 200);
    const responseToFeedback = await jsonRequest(
        `/admin/feedback/${feedback.id}/response`,
        { response: "We have updated the venue details." },
        admin.token,
        "PATCH"
    );
    assert.equal(responseToFeedback.status, 200);

    const ownFeedback = await request("/my-feedback", {
        headers: { Authorization: `Bearer ${student.token}` }
    }).then(response => response.json());
    assert.equal(ownFeedback.length, 1);
    assert.equal(ownFeedback[0].status, "Under Review");
    assert.equal(ownFeedback[0].adminResponse, "We have updated the venue details.");

    server.close();
    await once(server, "close");
    app.locals.database.close();

    app = createApp({ databasePath, adminSignupKey });
    server = app.listen(0);
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;

    const persistedRegistrations = await request("/my-registrations", {
        headers: { Authorization: `Bearer ${student.token}` }
    }).then(response => response.json());
    assert.equal(persistedRegistrations.length, 1);
    assert.equal(persistedRegistrations[0].eventTitle, "Small Demo Workshop");
    assert.match(persistedRegistrations[0].qrCode, /^data:image\/png;base64,/);
    assert.ok(persistedRegistrations[0].attendedAt);

    const persistedFeedback = await request("/my-feedback", {
        headers: { Authorization: `Bearer ${student.token}` }
    }).then(response => response.json());
    assert.equal(persistedFeedback[0].status, "Under Review");
    assert.equal(persistedFeedback[0].adminResponse, "We have updated the venue details.");
});
