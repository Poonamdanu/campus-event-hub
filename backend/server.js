const path = require("node:path");
const {
    randomBytes,
    randomUUID,
    scryptSync,
    timingSafeEqual,
    createHash
} = require("node:crypto");
const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { openDatabase } = require("./database");

const categories = new Set([
    "Technical", "Cultural", "Sports", "Workshop", "Music", "Other"
]);

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + "T00:00:00.000Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validateEvent(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return "A valid event object is required.";
    }

    const fields = ["title", "category", "date", "time", "venue", "description"];
    for (const field of fields) {
        if (typeof input[field] !== "string" || !input[field].trim()) {
            return `${field} is required.`;
        }
    }

    if (input.title.trim().length > 120) return "title must be 120 characters or fewer.";
    if (input.venue.trim().length > 150) return "venue must be 150 characters or fewer.";
    if (input.description.trim().length > 2000) return "description must be 2000 characters or fewer.";
    if (!categories.has(input.category)) return "category is not supported.";
    if (!isValidDate(input.date)) return "date must be a valid YYYY-MM-DD date.";
    if (!isValidTime(input.time)) return "time must be a valid 24-hour HH:MM time.";
    if (!Number.isInteger(Number(input.capacity)) || Number(input.capacity) < 1 || Number(input.capacity) > 100000) {
        return "capacity must be a whole number between 1 and 100000.";
    }
    if (input.durationMinutes !== undefined &&
        (!Number.isInteger(Number(input.durationMinutes)) ||
            Number(input.durationMinutes) < 15 || Number(input.durationMinutes) > 1440)) {
        return "durationMinutes must be a whole number between 15 and 1440.";
    }

    return null;
}

function createAttendanceCode() {
    return randomBytes(32).toString("base64url");
}

async function attachQrCodes(registrations) {
    return Promise.all(registrations.map(async registration => ({
        ...registration,
        qrCode: registration.attendanceCode
            ? await QRCode.toDataURL(registration.attendanceCode, {
                errorCorrectionLevel: "M",
                margin: 2,
                width: 220
            })
            : null
    })));
}

function hashPassword(password) {
    const salt = randomBytes(16);
    const derived = scryptSync(password, salt, 64);
    return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

function verifyPassword(password, passwordHash) {
    const [saltHex, hashHex] = passwordHash.split(":");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

function createSession(database, userId, rememberMe = false) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() +
        (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000).toISOString();
    database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
        .run(hashToken(token), userId, expiresAt);
    return { token, expiresAt };
}

function createApp(options = {}) {
    const database = openDatabase(options.databasePath);
    database.exec(`
        UPDATE registrations
        SET attendance_code = lower(hex(randomblob(32)))
        WHERE attendance_code IS NULL
    `);
    const app = express();
    const api = express.Router();
    const projectRoot = path.resolve(__dirname, "..");
    const allowedOrigins = (process.env.CORS_ORIGINS ||
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean);
    const adminSignupKey = options.adminSignupKey || process.env.ADMIN_SIGNUP_KEY || "";

    app.use(cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(null, false);
        }
    }));
    app.use(express.json({ limit: "32kb" }));

    function listEvents(status, ownerId) {
        const conditions = [];
        const values = [];
        if (status) {
            conditions.push("e.status = ?");
            values.push(status);
        }
        if (ownerId) {
            conditions.push("e.owner_id = ?");
            values.push(ownerId);
        }
        const query = `
            SELECT e.*,
                e.duration_minutes AS durationMinutes,
                COUNT(r.id) AS registeredCount,
                MAX(e.capacity - COUNT(r.id), 0) AS remainingCapacity
            FROM events e
            LEFT JOIN registrations r ON r.event_id = e.id
            ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
            GROUP BY e.id
            ORDER BY e.date, e.time, e.title
        `;
        return database.prepare(query).all(...values);
    }

    function eventById(id, status) {
        const query = `
            SELECT e.*,
                e.duration_minutes AS durationMinutes,
                COUNT(r.id) AS registeredCount,
                MAX(e.capacity - COUNT(r.id), 0) AS remainingCapacity
            FROM events e
            LEFT JOIN registrations r ON r.event_id = e.id
            WHERE e.id = ? ${status ? "AND e.status = ?" : ""}
            GROUP BY e.id
        `;
        return status
            ? database.prepare(query).get(id, status)
            : database.prepare(query).get(id);
    }

    function registrationsFor(email) {
        return database.prepare(`
            SELECT r.id, r.event_id AS eventId, r.name, r.email,
                r.attendance_code AS attendanceCode,
                r.attended_at AS attendedAt,
                r.registered_at AS registeredAt,
                e.title AS eventTitle, e.date AS eventDate,
                e.time AS eventTime, e.duration_minutes AS durationMinutes,
                e.venue, e.category, e.status
            FROM registrations r
            JOIN events e ON e.id = r.event_id
            WHERE r.email = ? COLLATE NOCASE
            ORDER BY e.date, e.time
        `).all(email);
    }

    function requireAuth(request, response, next) {
        const authorization = request.get("authorization") || "";
        const match = authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/);
        if (!match) return response.status(401).json({ error: "Please log in to continue." });

        const session = database.prepare(`
            SELECT u.id, u.name, u.email, u.role, u.college, u.college_id AS collegeId
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
        `).get(hashToken(match[1]), new Date().toISOString());
        if (!session) return response.status(401).json({ error: "Your session expired. Please log in again." });
        request.user = session;
        next();
    }

    function requireRole(...roles) {
        return (request, response, next) => {
            requireAuth(request, response, error => {
                if (error) return next(error);
                if (!roles.includes(request.user.role)) {
                    return response.status(403).json({ error: "You do not have permission to access this portal." });
                }
                next();
            });
        };
    }

    api.get("/health", (request, response) => {
        response.json({ status: "ok", database: "connected" });
    });

    api.post("/auth/signup", (request, response) => {
        const body = request.body && typeof request.body === "object" ? request.body : {};
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const role = body.role;
        const college = typeof body.college === "string" ? body.college.trim() : "";
        const collegeId = typeof body.collegeId === "string" ? body.collegeId.trim() : "";

        if (!name || name.length > 100) {
            return response.status(400).json({ error: "Name is required and must be 100 characters or fewer." });
        }
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return response.status(400).json({ error: "A valid email address is required." });
        }
        if (password.length < 8 || password.length > 128) {
            return response.status(400).json({ error: "Password must be 8 to 128 characters long." });
        }
        if (!["student", "organizer", "admin"].includes(role)) {
            return response.status(400).json({ error: "Choose student, organizer, or admin as the account type." });
        }
        if ((role === "student" || role === "organizer") && (!college || !collegeId)) {
            return response.status(400).json({ error: "College and student/employee ID are required." });
        }
        const user = {
            id: randomUUID(),
            name,
            email,
            role,
            college: college.slice(0, 150),
            collegeId: collegeId.slice(0, 100),
            passwordHash: hashPassword(password)
        };

        let session;
        database.exec("BEGIN IMMEDIATE");
        try {
            const existing = database.prepare(
                "SELECT id FROM users WHERE email = ? COLLATE NOCASE"
            ).get(email);
            if (existing) {
                database.exec("ROLLBACK");
                return response.status(409).json({ error: "This email already has an account." });
            }

            if (role === "admin") {
                const adminCount = database.prepare(
                    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
                ).get().count;
                const suppliedKey = typeof body.adminKey === "string"
                    ? Buffer.from(body.adminKey)
                    : Buffer.alloc(0);
                const expectedKey = Buffer.from(adminSignupKey);
                const validKey = adminSignupKey &&
                    suppliedKey.length === expectedKey.length &&
                    timingSafeEqual(suppliedKey, expectedKey);

                if (adminSignupKey && !validKey) {
                    database.exec("ROLLBACK");
                    return response.status(403).json({ error: "The admin setup key is invalid." });
                }
                if (!adminSignupKey && adminCount > 0) {
                    database.exec("ROLLBACK");
                    return response.status(403).json({
                        error: "An administrator account already exists. Configure ADMIN_SIGNUP_KEY on the server to add another."
                    });
                }
            }

            database.prepare(`
                INSERT INTO users (id, name, email, password_hash, role, college, college_id)
                VALUES (@id, @name, @email, @passwordHash, @role, @college, @collegeId)
            `).run(user);
            session = createSession(database, user.id);
            database.exec("COMMIT");
        } catch (error) {
            database.exec("ROLLBACK");
            throw error;
        }

        const { token, expiresAt } = session;
        response.status(201).json({
            token,
            expiresAt,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                college: user.college,
                collegeId: user.collegeId
            }
        });
    });

    api.post("/auth/login", (request, response) => {
        const body = request.body && typeof request.body === "object" ? request.body : {};
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const user = database.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
        if (!user || !verifyPassword(password, user.password_hash)) {
            return response.status(401).json({ error: "Invalid email or password." });
        }

        const { token, expiresAt } = createSession(database, user.id, body.rememberMe === true);
        response.json({
            token,
            expiresAt,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                college: user.college,
                collegeId: user.college_id
            }
        });
    });

    api.get("/auth/me", requireAuth, (request, response) => {
        response.json({ user: request.user });
    });

    api.post("/auth/logout", requireAuth, (request, response) => {
        const token = request.get("authorization").slice("Bearer ".length);
        database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
        response.status(204).end();
    });

    api.get("/events", (request, response) => {
        const events = listEvents("approved");
        const query = String(request.query.search || "").trim().toLowerCase();
        const category = String(request.query.category || "").trim().toLowerCase();
        const venue = String(request.query.venue || "").trim().toLowerCase();
        const date = String(request.query.date || "").trim();

        response.json(events.filter(event =>
            (!query || [event.title, event.description, event.category, event.venue, event.organizer]
                .some(value => value.toLowerCase().includes(query))) &&
            (!category || event.category.toLowerCase() === category) &&
            (!venue || event.venue.toLowerCase().includes(venue)) &&
            (!date || event.date === date)
        ));
    });

    api.get("/events/:id", (request, response) => {
        const event = eventById(request.params.id, "approved");
        if (!event) return response.status(404).json({ error: "Event not found." });
        response.json(event);
    });

    api.post("/events/:id/register", requireRole("student"), async (request, response) => {
        const name = request.user.name;
        const email = request.user.email.toLowerCase();
        if (!name || name.length > 100) {
            return response.status(400).json({ error: "name is required and must be 100 characters or fewer." });
        }
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return response.status(400).json({ error: "A valid email address is required." });
        }

        database.exec("BEGIN IMMEDIATE");
        try {
            const event = database.prepare("SELECT * FROM events WHERE id = ? AND status = 'approved'")
                .get(request.params.id);
            if (!event) {
                database.exec("ROLLBACK");
                return response.status(404).json({ error: "Event not found or not open for registration." });
            }

            const duplicate = database.prepare(`
                SELECT id FROM registrations WHERE event_id = ? AND email = ? COLLATE NOCASE
            `).get(event.id, email);
            if (duplicate) {
                database.exec("ROLLBACK");
                return response.status(409).json({ error: "This email is already registered for the event." });
            }

            const count = database.prepare(
                "SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?"
            ).get(event.id).count;
            if (count >= event.capacity) {
                database.exec("ROLLBACK");
                return response.status(409).json({ error: "This event has reached its registration capacity." });
            }

            const attendanceCode = createAttendanceCode();
            const qrCode = await QRCode.toDataURL(attendanceCode, {
                errorCorrectionLevel: "M",
                margin: 2,
                width: 220
            });
            const registration = database.prepare(`
                INSERT INTO registrations (event_id, name, email, attendance_code) VALUES (?, ?, ?, ?)
            `).run(event.id, name, email, attendanceCode);
            database.exec("COMMIT");

            return response.status(201).json({
                id: registration.lastInsertRowid,
                eventId: event.id,
                attendanceCode,
                qrCode,
                eventTitle: event.title,
                eventDate: event.date,
                eventTime: event.time,
                durationMinutes: event.duration_minutes,
                venue: event.venue,
                category: event.category,
                name,
                email,
                status: "Registered",
                registeredAt: new Date().toISOString()
            });
        } catch (error) {
            database.exec("ROLLBACK");
            throw error;
        }
    });

    api.get("/my-registrations", requireRole("student"), (request, response) => {
        attachQrCodes(registrationsFor(request.user.email))
            .then(registrations => response.json(registrations))
            .catch(error => response.status(500).json({ error: error.message }));
    });

    api.post("/feedback", requireAuth, (request, response) => {
        const body = request.body && typeof request.body === "object" ? request.body : {};
        const types = ["Suggestion", "Complaint", "Event Review", "Technical Issue", "Appreciation"];
        const type = body.type;
        const eventName = typeof body.eventName === "string" ? body.eventName.trim() : "";
        const message = typeof body.message === "string" ? body.message.trim() : "";
        const rating = body.rating === "" || body.rating === null || body.rating === undefined
            ? null
            : Number(body.rating);
        if (!types.includes(type)) return response.status(400).json({ error: "Choose a valid feedback type." });
        if (!message || message.length > 3000) {
            return response.status(400).json({ error: "Message is required and must be 3000 characters or fewer." });
        }
        if (eventName.length > 150) return response.status(400).json({ error: "Event name must be 150 characters or fewer." });
        if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
            return response.status(400).json({ error: "Rating must be between 1 and 5." });
        }
        const id = randomUUID();
        database.prepare(`
            INSERT INTO feedback (id, user_id, type, event_name, rating, message)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, request.user.id, type, eventName, rating, message);
        response.status(201).json(database.prepare(`
            SELECT f.id, f.type, f.event_name AS eventName, f.rating, f.message,
                f.status, f.submitted_at AS submittedAt
            FROM feedback f WHERE f.id = ?
        `).get(id));
    });

    api.get("/my-feedback", requireAuth, (request, response) => {
        response.json(database.prepare(`
            SELECT id, type, event_name AS eventName, rating, message,
                status, admin_response AS adminResponse, submitted_at AS submittedAt
            FROM feedback WHERE user_id = ? ORDER BY submitted_at DESC
        `).all(request.user.id));
    });

    api.get("/organizer/events", requireRole("organizer"), (request, response) => {
        response.json(listEvents(null, request.user.id));
    });

    api.post("/organizer/events", requireRole("organizer"), (request, response) => {
        const error = validateEvent(request.body);
        if (error) return response.status(400).json({ error });
        const input = request.body;
        const event = {
            id: "ORG-" + randomUUID(),
            title: input.title.trim(),
            category: input.category,
            date: input.date,
            time: input.time,
            venue: input.venue.trim(),
            description: input.description.trim(),
            capacity: Number(input.capacity),
            durationMinutes: Number(input.durationMinutes || 60),
            ownerId: request.user.id,
            organizer: request.user.name
        };
        database.prepare(`
            INSERT INTO events
                (id, title, category, date, time, venue, description, capacity, duration_minutes, organizer, status, owner_id)
            VALUES
                (@id, @title, @category, @date, @time, @venue, @description, @capacity, @durationMinutes, @organizer, 'pending', @ownerId)
        `).run(event);
        response.status(201).json({ ...event, status: "pending", registeredCount: 0, remainingCapacity: event.capacity });
    });

    api.put("/organizer/events/:id", requireRole("organizer"), (request, response) => {
        const error = validateEvent(request.body);
        if (error) return response.status(400).json({ error });
        const input = request.body;
        const result = database.prepare(`
            UPDATE events SET title = ?, category = ?, date = ?, time = ?, venue = ?,
                description = ?, capacity = ?, duration_minutes = ?, status = 'pending'
            WHERE id = ? AND owner_id = ?
        `).run(
            input.title.trim(), input.category, input.date, input.time,
            input.venue.trim(), input.description.trim(), Number(input.capacity),
            Number(input.durationMinutes || 60),
            request.params.id, request.user.id
        );
        if (!result.changes) return response.status(404).json({ error: "Event not found." });
        response.json(eventById(request.params.id));
    });

    api.delete("/organizer/events/:id", requireRole("organizer"), (request, response) => {
        const result = database.prepare("DELETE FROM events WHERE id = ? AND owner_id = ?")
            .run(request.params.id, request.user.id);
        if (!result.changes) return response.status(404).json({ error: "Event not found." });
        response.status(204).end();
    });

    api.get("/organizer/events/:id/registrations", requireRole("organizer"), (request, response) => {
        if (!database.prepare("SELECT id FROM events WHERE id = ? AND owner_id = ?")
            .get(request.params.id, request.user.id)) {
            return response.status(404).json({ error: "Event not found." });
        }
        const registrations = database.prepare(`
            SELECT id, event_id AS eventId, name, email, attended_at AS attendedAt,
                registered_at AS registeredAt
            FROM registrations WHERE event_id = ? ORDER BY registered_at DESC
        `).all(request.params.id);
        response.json(registrations);
    });

    api.post("/organizer/events/:id/check-in", requireRole("organizer"), (request, response) => {
        const code = typeof request.body?.code === "string" ? request.body.code.trim() : "";
        if (!code || code.length > 200) {
            return response.status(400).json({ error: "Enter a valid attendance QR code." });
        }
        if (!database.prepare("SELECT id FROM events WHERE id = ? AND owner_id = ?")
            .get(request.params.id, request.user.id)) {
            return response.status(404).json({ error: "Event not found." });
        }
        const registration = database.prepare(`
            SELECT id, name, attended_at AS attendedAt
            FROM registrations
            WHERE event_id = ? AND attendance_code = ?
        `).get(request.params.id, code);
        if (!registration) {
            return response.status(404).json({ error: "QR code is not valid for this event." });
        }
        if (registration.attendedAt) {
            return response.status(409).json({ error: `${registration.name} has already checked in.` });
        }
        const attendedAt = new Date().toISOString();
        database.prepare("UPDATE registrations SET attended_at = ? WHERE id = ?")
            .run(attendedAt, registration.id);
        response.json({ name: registration.name, attendedAt });
    });

    api.get("/organizer/stats", requireRole("organizer"), (request, response) => {
        const totalEvents = database.prepare("SELECT COUNT(*) AS count FROM events WHERE owner_id = ?")
            .get(request.user.id).count;
        const upcomingEvents = database.prepare(
            "SELECT COUNT(*) AS count FROM events WHERE owner_id = ? AND date >= date('now')"
        ).get(request.user.id).count;
        const totalRegistrations = database.prepare(
            "SELECT COUNT(*) AS count FROM registrations r JOIN events e ON e.id = r.event_id WHERE e.owner_id = ?"
        ).get(request.user.id).count;
        response.json({ totalEvents, upcomingEvents, totalRegistrations });
    });

    api.get("/admin/events", requireRole("admin"), (request, response) => {
        response.json(listEvents(null));
    });

    api.patch("/admin/events/:id/status", requireRole("admin"), (request, response) => {
        const status = request.body && request.body.status;
        if (!["pending", "approved", "rejected"].includes(status)) {
            return response.status(400).json({ error: "status must be pending, approved, or rejected." });
        }
        const result = database.prepare("UPDATE events SET status = ? WHERE id = ?")
            .run(status, request.params.id);
        if (!result.changes) return response.status(404).json({ error: "Event not found." });
        response.json(eventById(request.params.id));
    });

    api.get("/admin/stats", requireRole("admin"), (request, response) => {
        const totalEvents = database.prepare("SELECT COUNT(*) AS count FROM events").get().count;
        const totalRegistrations = database.prepare("SELECT COUNT(*) AS count FROM registrations").get().count;
        const pendingEvents = database.prepare(
            "SELECT COUNT(*) AS count FROM events WHERE status = 'pending'"
        ).get().count;
        response.json({ totalEvents, totalRegistrations, pendingEvents });
    });

    api.get("/admin/registrations", requireRole("admin"), (request, response) => {
        response.json(database.prepare(`
            SELECT id, event_id AS eventId, name, email, registered_at AS registeredAt
            FROM registrations ORDER BY registered_at DESC
        `).all());
    });

    api.get("/admin/feedback", requireRole("admin"), (request, response) => {
        response.json(database.prepare(`
            SELECT f.id, f.type, f.event_name AS eventName, f.rating, f.message,
                f.status, f.admin_response AS adminResponse, f.submitted_at AS submittedAt,
                u.name, u.email, u.role
            FROM feedback f
            JOIN users u ON u.id = f.user_id
            ORDER BY f.submitted_at DESC
        `).all());
    });

    api.patch("/admin/feedback/:id/status", requireRole("admin"), (request, response) => {
        const status = request.body && request.body.status;
        if (!["Submitted", "Under Review", "Resolved", "Closed"].includes(status)) {
            return response.status(400).json({ error: "Choose a valid feedback status." });
        }
        const result = database.prepare("UPDATE feedback SET status = ? WHERE id = ?")
            .run(status, request.params.id);
        if (!result.changes) return response.status(404).json({ error: "Feedback entry not found." });
        response.json({ id: request.params.id, status });
    });

    api.patch("/admin/feedback/:id/response", requireRole("admin"), (request, response) => {
        const adminResponse = typeof request.body?.response === "string"
            ? request.body.response.trim()
            : null;
        if (adminResponse === null || adminResponse.length > 3000) {
            return response.status(400).json({ error: "Response is required and must be 3000 characters or fewer." });
        }
        const result = database.prepare("UPDATE feedback SET admin_response = ? WHERE id = ?")
            .run(adminResponse, request.params.id);
        if (!result.changes) return response.status(404).json({ error: "Feedback entry not found." });
        response.json({ id: request.params.id, adminResponse });
    });

    app.use("/api", api);
    app.use("/", api);
    app.use((request, response, next) => {
        let requestedPath;
        try {
            requestedPath = path.posix.normalize(
                decodeURIComponent(request.path).replace(/\\/g, "/")
            ).toLowerCase();
        } catch (error) {
            return response.status(400).end();
        }
        if (requestedPath.split("/").some(segment =>
            segment === "backend" || segment === "node_modules"
        )) {
            return response.sendStatus(404);
        }
        next();
    });
    app.use(express.static(projectRoot));
    app.use((error, request, response, next) => {
        if (response.headersSent) return next(error);
        if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
            return response.status(400).json({ error: "Request body must be valid JSON." });
        }
        console.error(error);
        response.status(500).json({ error: "Internal server error." });
    });

    app.locals.database = database;
    return app;
}

if (require.main === module) {
    const app = createApp({ databasePath: process.env.DB_PATH });
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => {
        console.log(`Campus Event Hub is running at http://localhost:${port}`);
        console.log(`SQLite database: ${process.env.DB_PATH || path.join(__dirname, "data", "campus-events.sqlite")}`);
    });
}

module.exports = { createApp };
