
document.addEventListener("DOMContentLoaded", function () {
    const registeredEventsContainer =
        document.getElementById("registeredEvents");
    const ticketsContainer = document.getElementById("studentTickets");

    const recommendedEventsContainer =
        document.getElementById("recommendedEvents");

    const conflictsContainer =
        document.getElementById("scheduleConflicts");

    const alertsContainer =
        document.getElementById("studentAlerts");

    const registeredCount =
        document.getElementById("registeredCount");

    const upcomingCount =
        document.getElementById("upcomingCount");

    const certificateCount =
        document.getElementById("certificateCount");

    const achievementCount =
        document.getElementById("achievementCount");

    const studentNameElement =
        document.getElementById("studentName");

    const achievementsContainer =
        document.getElementById("studentAchievements");

    const certificatesContainer =
        document.getElementById("studentCertificates");


    let availableEvents = [];

    function formatDate(date) {
        return new Date(date + "T00:00:00").toLocaleDateString(
            "en-IN",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );
    }


    function formatTime(time) {
        if (!time) {
            return "Time not specified";
        }

        const parts = time.split(":");
        let hours = Number(parts[0]);
        const minutes = parts[1] || "00";
        const period = hours >= 12 ? "PM" : "AM";

        hours = hours % 12 || 12;

        return `${hours}:${minutes} ${period}`;
    }


    function createEmptyMessage(message) {
        const paragraph = document.createElement("p");

        paragraph.className = "empty-state";
        paragraph.textContent = message;

        return paragraph;
    }


    function createEventCard(event, isRegistered) {
        const card = document.createElement("div");

        card.className = "student-event-card";

        const title = document.createElement("h3");
        title.textContent = event.eventTitle || event.title;

        const date = document.createElement("p");
        date.textContent = "📅 " + formatDate(event.eventDate || event.date);

        const time = document.createElement("p");
        time.textContent = "🕒 " + formatTime(event.eventTime || event.time);

        const venue = document.createElement("p");
        venue.textContent = "📍 " + (event.venue || "Venue not specified");

        const status = document.createElement("span");
        status.className = "event-status";
        status.textContent = isRegistered ? "Registered" : "Recommended";

        card.append(title, date, time, venue, status);

        return card;
    }

    function renderTickets(registrations) {
        ticketsContainer.replaceChildren();
        if (registrations.length === 0) {
            ticketsContainer.appendChild(createEmptyMessage("Register for an event to receive your QR ticket."));
            return;
        }

        registrations.forEach(function (registration) {
            const card = document.createElement("article");
            card.className = "student-event-card";
            const title = document.createElement("h3");
            title.textContent = registration.eventTitle;
            const details = document.createElement("p");
            details.textContent = formatDate(registration.eventDate) + " · " +
                formatTime(registration.eventTime) + " · " + registration.venue;
            const state = document.createElement("p");
            state.textContent = registration.attendedAt
                ? "Attendance verified"
                : "Show this QR code to the organizer at the event.";
            card.append(title, details, state);

            if (registration.qrCode) {
                const image = document.createElement("img");
                image.src = registration.qrCode;
                image.alt = "Attendance QR ticket for " + registration.eventTitle;
                image.width = 220;
                image.height = 220;
                card.appendChild(image);
            } else {
                card.appendChild(createEmptyMessage("QR ticket is unavailable for this registration."));
            }
            ticketsContainer.appendChild(card);
        });
    }

    function renderRegisteredEvents(registrations) {
        registeredEventsContainer.replaceChildren();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = registrations.filter(function (event) {
            const eventDate = new Date(event.eventDate + "T00:00:00");
            return eventDate >= today;
        });

        registeredCount.textContent = registrations.length;
        upcomingCount.textContent = upcoming.length;

        if (registrations.length === 0) {
            registeredEventsContainer.appendChild(
                createEmptyMessage(
                    "You have not registered for any events yet. Explore events to get started!"
                )
            );

            return;
        }

        if (upcoming.length === 0) {
            registeredEventsContainer.appendChild(
                createEmptyMessage(
                    "You have no upcoming registered events."
                )
            );

            return;
        }

        upcoming.sort(function (a, b) {
            return new Date(a.eventDate) - new Date(b.eventDate);
        });

        upcoming.forEach(function (event) {
            registeredEventsContainer.appendChild(
                createEventCard(event, true)
            );
        });
    }


    function renderRecommendations(registrations) {
        recommendedEventsContainer.replaceChildren();

        const registeredIds = registrations.map(function (event) {
            return event.eventId;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const recommendations = availableEvents.filter(function (event) {
            return (
                !registeredIds.includes(event.id) &&
                new Date(event.date + "T00:00:00") >= today
            );
        });

        if (recommendations.length === 0) {
            recommendedEventsContainer.appendChild(
                createEmptyMessage(
                    "You are all caught up with our current sample recommendations!"
                )
            );

            return;
        }

        recommendations.slice(0, 3).forEach(function (event) {
            recommendedEventsContainer.appendChild(
                createEventCard(event, false)
            );
        });
    }


    function renderScheduleConflicts(registrations) {
        conflictsContainer.replaceChildren();

        const conflicts = [];

        for (let i = 0; i < registrations.length; i++) {
            for (let j = i + 1; j < registrations.length; j++) {
                const first = registrations[i];
                const second = registrations[j];

                const firstStart = first.eventTime.split(":").map(Number);
                const secondStart = second.eventTime.split(":").map(Number);
                const firstStartMinutes = firstStart[0] * 60 + firstStart[1];
                const secondStartMinutes = secondStart[0] * 60 + secondStart[1];
                const firstEndMinutes = firstStartMinutes + Number(first.durationMinutes || 60);
                const secondEndMinutes = secondStartMinutes + Number(second.durationMinutes || 60);

                if (
                    first.eventDate === second.eventDate &&
                    firstStartMinutes < secondEndMinutes &&
                    secondStartMinutes < firstEndMinutes
                ) {
                    conflicts.push({
                        first: first.eventTitle,
                        second: second.eventTitle,
                        date: first.eventDate
                    });
                }
            }
        }

        if (conflicts.length === 0) {
            conflictsContainer.appendChild(
                createEmptyMessage(
                    "No overlapping event times detected among your registered events."
                )
            );

            return;
        }

        conflicts.forEach(function (conflict) {
            const alert = document.createElement("div");

            alert.className = "conflict-alert";

            const heading = document.createElement("h4");
            heading.textContent = "⚠️ Schedule Conflict";

            const description = document.createElement("p");
            description.textContent =
                conflict.first + " and " + conflict.second +
                " overlap on " +
                formatDate(conflict.date) + ".";

            alert.append(heading, description);
            conflictsContainer.appendChild(alert);
        });
    }


    function renderAlerts(registrations) {
        alertsContainer.replaceChildren();

        if (registrations.length === 0) {
            alertsContainer.appendChild(
                createEmptyMessage(
                    "Your reminders will appear here after you register for an event."
                )
            );

            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = registrations
            .filter(function (event) {
                const eventDate = new Date(event.eventDate + "T00:00:00");
                return eventDate >= today;
            })
            .sort(function (a, b) {
                return new Date(a.eventDate) - new Date(b.eventDate);
            });

        if (upcoming.length === 0) {
            alertsContainer.appendChild(
                createEmptyMessage(
                    "You have no upcoming registered events."
                )
            );

            return;
        }

        const nextEvent = upcoming[0];

        const reminder = document.createElement("div");
        reminder.className = "student-alert";

        const heading = document.createElement("h4");
        heading.textContent = "📢 Your Next Event";

        const message = document.createElement("p");
        message.textContent =
            nextEvent.eventTitle + " is scheduled for " +
            formatDate(nextEvent.eventDate) + " at " +
            formatTime(nextEvent.eventTime) + ".";

        reminder.append(heading, message);
        alertsContainer.appendChild(reminder);
    }


    function renderAchievements(registrations) {
        achievementsContainer.replaceChildren();

        const achievements = [];

        if (registrations.length >= 1) {
            achievements.push("🎯 First Event Registration");
        }

        if (registrations.length >= 3) {
            achievements.push("🏆 Event Enthusiast");
        }

        if (registrations.length >= 5) {
            achievements.push("🌟 Campus Explorer");
        }

        achievementCount.textContent = achievements.length;

        if (achievements.length === 0) {
            achievementsContainer.appendChild(
                createEmptyMessage(
                    "Register for events to unlock achievements."
                )
            );

            return;
        }

        achievements.forEach(function (achievement) {
            const item = document.createElement("div");

            item.className = "achievement-card";
            item.textContent = achievement;

            achievementsContainer.appendChild(item);
        });
    }


    function renderCertificates() {
        certificateCount.textContent = "0";

        certificatesContainer.replaceChildren();

        certificatesContainer.appendChild(
            createEmptyMessage(
                "Certificates will appear here when certificate support is added."
            )
        );
    }


    function renderDashboard(registrations) {
        if (studentNameElement) {
            let savedUser = null;
            try {
                savedUser = JSON.parse(localStorage.getItem("eventoraUser") || "null");
            } catch (error) {
                savedUser = null;
            }

            if (savedUser && savedUser.name) {
                studentNameElement.textContent = savedUser.name;
            } else if (registrations.length > 0 && registrations[0].name) {
                studentNameElement.textContent = registrations[0].name;
            } else {
                studentNameElement.textContent = "Student";
            }
        }

        renderRegisteredEvents(registrations);
        renderTickets(registrations);
        renderRecommendations(registrations);
        renderScheduleConflicts(registrations);
        renderAlerts(registrations);
        renderAchievements(registrations);
        renderCertificates();
    }

    async function loadDashboard() {
        try {
            const results = await Promise.all([
                window.CampusAPI.listEvents(),
                window.CampusAPI.myRegistrations()
            ]);
            availableEvents = results[0];
            renderDashboard(results[1]);
        } catch (error) {
            registeredEventsContainer.replaceChildren(
                createEmptyMessage("Could not load your dashboard: " + error.message)
            );
            recommendedEventsContainer.replaceChildren(
                createEmptyMessage("The events service is currently unavailable.")
            );
        }
    }

    loadDashboard();
});
