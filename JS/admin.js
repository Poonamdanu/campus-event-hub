
document.addEventListener("DOMContentLoaded", function () {
    const eventsList = document.getElementById("adminEventsList");
    const feedbackList = document.getElementById("adminFeedbackList");
    const searchInput = document.getElementById("adminEventSearch");

    let activeFilter = "all";
    let events = [];
    let registrations = [];
    let feedback = [];
    let statistics = { totalEvents: 0, totalRegistrations: 0, pendingEvents: 0 };

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function formatDate(date) {
        if (!date) {
            return "Date not specified";
        }

        const parsedDate = new Date(date + "T00:00:00");

        if (Number.isNaN(parsedDate.getTime())) {
            return "Date not specified";
        }

        return parsedDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function getStatus(event) {
        return event.status || "pending";
    }

    function updateStatistics() {
        document.getElementById("adminTotalEvents").textContent =
            statistics.totalEvents;

        document.getElementById("adminTotalRegistrations").textContent =
            registrations.length;

        document.getElementById("adminPendingEvents").textContent =
            statistics.pendingEvents;

        document.getElementById("adminFeedbackCount").textContent =
            feedback.length;
    }

    function renderEvents() {
        const searchText = searchInput.value.trim().toLowerCase();

        const filteredEvents = events.filter(function (event) {
            const status = getStatus(event);

            const matchesStatus =
                activeFilter === "all" || status === activeFilter;

            const searchableText = [
                event.title,
                event.category,
                event.venue
            ].join(" ").toLowerCase();

            return matchesStatus && searchableText.includes(searchText);
        });

        eventsList.replaceChildren();

        if (filteredEvents.length === 0) {
            eventsList.appendChild(
                createElement(
                    "p",
                    "admin-empty-state",
                    "No events found for this filter."
                )
            );

            return;
        }

        filteredEvents.forEach(function (event) {
            const card = createElement("article", "admin-event-card");

            const header = createElement("div", "admin-event-header");

            const title = createElement("h3", "", event.title);
            const status = getStatus(event);

            const badge = createElement(
                "span",
                "admin-status-badge status-" + status,
                status.charAt(0).toUpperCase() + status.slice(1)
            );

            header.append(title, badge);

            const category = createElement(
                "p",
                "admin-event-meta",
                (event.category || "Uncategorized") +
                " · " + formatDate(event.date) +
                " · " + (event.time || "Time not specified")
            );

            const venue = createElement(
                "p",
                "admin-event-meta",
                "📍 " + (event.venue || "Venue not specified")
            );

            const description = createElement(
                "p",
                "admin-event-description",
                event.description || "No description provided."
            );

            const actions = createElement("div", "admin-event-actions");

            if (status !== "approved") {
                const approveButton = createElement(
                    "button",
                    "admin-action-button approve-button",
                    "✓ Approve"
                );

                approveButton.type = "button";

                approveButton.addEventListener("click", function () {
                    updateEventStatus(event.id, "approved");
                });

                actions.appendChild(approveButton);
            }

            if (status !== "rejected") {
                const rejectButton = createElement(
                    "button",
                    "admin-action-button reject-button",
                    "✕ Reject"
                );

                rejectButton.type = "button";

                rejectButton.addEventListener("click", function () {
                    updateEventStatus(event.id, "rejected");
                });

                actions.appendChild(rejectButton);
            }

            if (status !== "pending") {
                const resetButton = createElement(
                    "button",
                    "admin-action-button reset-button",
                    "Reset to Pending"
                );

                resetButton.type = "button";

                resetButton.addEventListener("click", function () {
                    updateEventStatus(event.id, "pending");
                });

                actions.appendChild(resetButton);
            }

            card.append(header, category, venue, description, actions);
            eventsList.appendChild(card);
        });
    }

    async function updateEventStatus(eventId, newStatus) {
        try {
            await window.CampusAPI.setEventStatus(eventId, newStatus);
            await loadData();
            alert("Event status updated to " + newStatus + ".");
        } catch (error) {
            alert(error.message);
        }
    }

    function renderFeedback() {
        feedbackList.replaceChildren();

        if (feedback.length === 0) {
            feedbackList.appendChild(
                createElement(
                    "p",
                    "admin-empty-state",
                    "No feedback has been submitted yet."
                )
            );

            return;
        }

        feedback.forEach(function (item) {
            const card = createElement("article", "admin-feedback-card");

            const heading = createElement(
                "h3",
                "",
                item.type || "Student Feedback"
            );

            const message = createElement(
                "p",
                "",
                item.message || item.feedback || "No message provided."
            );

            const sender = createElement(
                "span",
                "admin-feedback-sender",
                "From: " + (item.name || item.email || "Student") +
                    " · " + (item.email || "")
            );

            const status = createElement("span", "admin-feedback-sender",
                "Status: " + item.status);
            const responseInput = document.createElement("textarea");
            responseInput.rows = 3;
            responseInput.maxLength = 3000;
            responseInput.placeholder = "Write a response for the student...";
            responseInput.value = item.adminResponse || "";
            responseInput.setAttribute("aria-label", "Response to " + (item.name || "student"));
            const controls = createElement("div", "admin-event-actions");
            const statusSelect = document.createElement("select");
            ["Submitted", "Under Review", "Resolved", "Closed"].forEach(function (value) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                option.selected = item.status === value;
                statusSelect.appendChild(option);
            });
            const saveButton = createElement("button", "admin-action-button approve-button", "Update status");
            saveButton.type = "button";
            saveButton.addEventListener("click", async function () {
                saveButton.disabled = true;
                try {
                    await window.CampusAPI.setFeedbackStatus(item.id, statusSelect.value);
                    await loadData();
                } catch (error) {
                    alert(error.message);
                } finally {
                    saveButton.disabled = false;
                }
            });
            const responseButton = createElement("button", "admin-action-button approve-button", "Save response");
            responseButton.type = "button";
            responseButton.addEventListener("click", async function () {
                responseButton.disabled = true;
                try {
                    await window.CampusAPI.respondToFeedback(item.id, responseInput.value);
                    await loadData();
                } catch (error) {
                    alert(error.message);
                } finally {
                    responseButton.disabled = false;
                }
            });
            controls.appendChild(statusSelect);
            controls.appendChild(saveButton);
            controls.appendChild(responseButton);
            card.append(heading, message, sender, status, responseInput, controls);
            feedbackList.appendChild(card);
        });
    }

    document.querySelectorAll(".admin-filter").forEach(function (button) {
        button.addEventListener("click", function () {
            activeFilter = button.dataset.status;

            document.querySelectorAll(".admin-filter").forEach(function (item) {
                item.classList.toggle("active", item === button);
            });

            renderEvents();
        });
    });

    searchInput.addEventListener("input", renderEvents);

    async function loadData() {
        try {
            [events, statistics, registrations, feedback] = await Promise.all([
                window.CampusAPI.adminEvents(),
                window.CampusAPI.adminStats(),
                window.CampusAPI.adminRegistrations(),
                window.CampusAPI.adminFeedback()
            ]);
            updateStatistics();
            renderEvents();
            renderFeedback();
        } catch (error) {
            eventsList.replaceChildren(createElement("p", "admin-empty-state",
                "Could not load admin data: " + error.message));
        }
    }

    loadData();
});
