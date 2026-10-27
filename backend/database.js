const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const seedEvents = [
    {
        id: "EVT001",
        title: "CodeSprint Hackathon",
        category: "Technical",
        date: "2026-11-12",
        time: "09:00",
        venue: "Computer Science Block",
        description: "Build innovative solutions and compete with talented student developers.",
        capacity: 150,
        durationMinutes: 60,
        organizer: "Campus Tech Club"
    },
    {
        id: "EVT002",
        title: "Campus Cultural Fest",
        category: "Cultural",
        date: "2026-11-15",
        time: "10:00",
        venue: "Main Auditorium",
        description: "Celebrate campus creativity with performances, competitions, and activities.",
        capacity: 300,
        durationMinutes: 60,
        organizer: "Cultural Committee"
    },
    {
        id: "EVT003",
        title: "AI Innovation Workshop",
        category: "Workshop",
        date: "2026-11-18",
        time: "11:00",
        venue: "Innovation Lab",
        description: "Explore artificial intelligence concepts and practical applications.",
        capacity: 80,
        durationMinutes: 60,
        organizer: "Innovation Cell"
    },
    {
        id: "EVT004",
        title: "Intercollege Football",
        category: "Sports",
        date: "2026-11-20",
        time: "09:00",
        venue: "College Sports Ground",
        description: "Compete with other colleges in an exciting football tournament.",
        capacity: 100,
        durationMinutes: 60,
        organizer: "Sports Committee"
    },
    {
        id: "EVT005",
        title: "Campus Music Night",
        category: "Music",
        date: "2026-11-22",
        time: "17:00",
        venue: "Open Air Theatre",
        description: "Enjoy live music and performances from talented students.",
        capacity: 250,
        durationMinutes: 60,
        organizer: "Music Society"
    },
    {
        id: "EVT006",
        title: "Design Thinking Session",
        category: "Workshop",
        date: "2026-11-25",
        time: "10:00",
        venue: "Seminar Hall",
        description: "Learn creative problem-solving and collaborative design methods.",
        capacity: 60,
        durationMinutes: 60,
        organizer: "Design Club"
    }
];

function openDatabase(databasePath = path.join(__dirname, "data", "campus-events.sqlite")) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });

    const database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    database.exec(`
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            venue TEXT NOT NULL,
            description TEXT NOT NULL,
            capacity INTEGER NOT NULL CHECK(capacity > 0),
            duration_minutes INTEGER NOT NULL DEFAULT 60
                CHECK(duration_minutes BETWEEN 15 AND 1440),
            owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            organizer TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'approved'
                CHECK(status IN ('pending', 'approved', 'rejected')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
            email TEXT NOT NULL COLLATE NOCASE,
            registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            attendance_code TEXT UNIQUE,
            attended_at TEXT,
            UNIQUE(event_id, email)
        );

        CREATE INDEX IF NOT EXISTS registrations_event_id_idx
            ON registrations(event_id);

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student', 'organizer', 'admin')),
            college TEXT NOT NULL DEFAULT '',
            college_id TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
            ON sessions(expires_at);

        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK(type IN ('Suggestion', 'Complaint', 'Event Review', 'Technical Issue', 'Appreciation')),
            event_name TEXT NOT NULL DEFAULT '',
            rating INTEGER CHECK(rating IS NULL OR rating BETWEEN 1 AND 5),
            message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 3000),
            status TEXT NOT NULL DEFAULT 'Submitted'
                CHECK(status IN ('Submitted', 'Under Review', 'Resolved', 'Closed')),
            admin_response TEXT NOT NULL DEFAULT '',
            submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);
    `);

    const eventColumns = database.prepare("PRAGMA table_info(events)").all();
    if (!eventColumns.some(column => column.name === "owner_id")) {
        database.exec("ALTER TABLE events ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL");
    }

    if (!eventColumns.some(column => column.name === "duration_minutes")) {
        database.exec(`
            ALTER TABLE events ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 60
                CHECK(duration_minutes BETWEEN 15 AND 1440)
        `);
    }

    const registrationColumns = database.prepare("PRAGMA table_info(registrations)").all();
    if (!registrationColumns.some(column => column.name === "attendance_code")) {
        database.exec("ALTER TABLE registrations ADD COLUMN attendance_code TEXT");
    }
    if (!registrationColumns.some(column => column.name === "attended_at")) {
        database.exec("ALTER TABLE registrations ADD COLUMN attended_at TEXT");
    }

    const feedbackColumns = database.prepare("PRAGMA table_info(feedback)").all();
    if (!feedbackColumns.some(column => column.name === "admin_response")) {
        database.exec("ALTER TABLE feedback ADD COLUMN admin_response TEXT NOT NULL DEFAULT ''");
    }

    const eventCount = database.prepare("SELECT COUNT(*) AS count FROM events").get().count;
    if (eventCount === 0) {
        const insertEvent = database.prepare(`
            INSERT INTO events
                (id, title, category, date, time, venue, description, capacity, duration_minutes, organizer, status)
            VALUES
                (@id, @title, @category, @date, @time, @venue, @description, @capacity, @durationMinutes, @organizer, 'approved')
        `);

        database.exec("BEGIN IMMEDIATE");
        try {
            seedEvents.forEach(event => insertEvent.run(event));
            database.exec("COMMIT");
        } catch (error) {
            database.exec("ROLLBACK");
            throw error;
        }
    }

    return database;
}

module.exports = { openDatabase };
