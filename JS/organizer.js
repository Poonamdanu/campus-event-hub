
document.addEventListener("DOMContentLoaded", function () {
    const eventForm = document.getElementById("organizerEventForm");
    const formSection = document.getElementById("eventFormSection");
    const eventList = document.getElementById("organizerEventsList");
    const searchInput = document.getElementById("organizerSearch");
    const registrationSelect = document.getElementById("registrationEventSelect");
    const registrationList = document.getElementById("organizerRegistrationList");

    const titleInput = document.getElementById("eventTitle");
    const categoryInput = document.getElementById("eventCategory");
    const dateInput = document.getElementById("eventDate");
    const timeInput = document.getElementById("eventTime");
    const venueInput = document.getElementById("eventVenue");
    const capacityInput = document.getElementById("eventCapacity");
    const durationInput = document.getElementById("eventDuration");
    const descriptionInput = document.getElementById("eventDescription");
    const editingIdInput = document.getElementById("editingEventId");
    const checkInForm = document.getElementById("attendanceCheckInForm");
    const attendanceCodeInput = document.getElementById("attendanceCode");
    const checkInMessage = document.getElementById("checkInMessage");
    const scannerVideo = document.getElementById("qrScannerVideo");
    let scannerStream = null;
    let scannerTimer = null;
    let scannerBusy = false;

    let events = [];
    let stats = { totalEvents: 0, upcomingEvents: 0, totalRegistrations: 0 };

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

        return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function updateStats() {
        document.getElementById("totalEvents").textContent = stats.totalEvents;
        document.getElementById("upcomingEvents").textContent = stats.upcomingEvents;
        document.getElementById("totalRegistrations").textContent = stats.totalRegistrations;
    }

    function renderEvents() {
        eventList.replaceChildren();

        const searchText = searchInput.value.trim().toLowerCase();

        const filteredEvents = events.filter(function (event) {
            return (
                event.title.toLowerCase().includes(searchText) ||
                event.category.toLowerCase().includes(searchText) ||
                event.venue.toLowerCase().includes(searchText)
            );
        });

        if (filteredEvents.length === 0) {
            eventList.appendChild(
                createElement(
                    "p",
                    "empty-state",
                    "No events found. Create your first event!"
                )
            );
        }

        filteredEvents.forEach(function (event) {
            const card = createElement("article", "organizer-event-card");

            const heading = createElement("h3", "", event.title);

            const details = createElement(
                "p",
                "",
                event.category + " · " +
                formatDate(event.date) + " · " + event.time
            );

            const venue = createElement("p", "", "📍 " + event.venue);

            const capacity = createElement(
                "p",
                "",
                "Maximum participants: " + event.capacity
            );

            const registrationCount = createElement(
                "p",
                "registration-total",
                "Registrations: " + (event.registeredCount || 0)
            );

            const description = createElement(
                "p",
                "organizer-event-description",
                event.description
            );

            const status = createElement(
                "p",
                "organizer-event-status",
                "Status: " + (event.status || "Pending")
            );

            const actions = createElement("div", "organizer-event-actions");

            const editButton = createElement("button", "btn btn-secondary", "Edit");
            editButton.type = "button";
            editButton.addEventListener("click", function () {
                editEvent(event.id);
            });

            const deleteButton = createElement("button", "btn btn-danger", "Delete");
            deleteButton.type = "button";
            deleteButton.addEventListener("click", function () {
                deleteEvent(event.id);
            });

            actions.append(editButton, deleteButton);

            card.append(
                heading,
                details,
                venue,
                capacity,
                registrationCount,
                status,
                description,
                actions
            );

            eventList.appendChild(card);
        });

        renderRegistrationOptions();
        updateStats();
    }

    function resetForm() {
        eventForm.reset();
        durationInput.value = "60";
        editingIdInput.value = "";

        document.getElementById("eventFormTitle").textContent =
            "Create a New Event";

        document.getElementById("saveEventButton").textContent =
            "Save Event";
    }

    function openForm() {
        formSection.hidden = false;

        formSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function editEvent(eventId) {
        const event = events.find(function (item) {
            return item.id === eventId;
        });

        if (!event) {
            return;
        }

        editingIdInput.value = event.id;
        titleInput.value = event.title;
        categoryInput.value = event.category;
        dateInput.value = event.date;
        timeInput.value = event.time;
        venueInput.value = event.venue;
        capacityInput.value = event.capacity;
        durationInput.value = event.durationMinutes || 60;
        descriptionInput.value = event.description;

        document.getElementById("eventFormTitle").textContent = "Edit Event";
        document.getElementById("saveEventButton").textContent = "Update Event";

        openForm();
    }

    async function deleteEvent(eventId) {
        const event = events.find(function (item) {
            return item.id === eventId;
        });

        if (!event) {
            return;
        }

        if (!confirm('Are you sure you want to delete "' + event.title + '"?')) {
            return;
        }

        try {
            await window.CampusAPI.deleteEvent(eventId);
            await loadData();
        } catch (error) {
            alert(error.message);
        }
    }

    eventForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const title = titleInput.value.trim();
        const category = categoryInput.value;
        const date = dateInput.value;
        const time = timeInput.value;
        const venue = venueInput.value.trim();
        const capacity = Number(capacityInput.value);
        const description = descriptionInput.value.trim();

        if (!title || !category || !date || !time || !venue || !description) {
            alert("Please fill in all event details.");
            return;
        }

        if (capacity < 1) {
            alert("Maximum participants must be at least 1.");
            return;
        }
        const durationMinutes = Number(durationInput.value);
        if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440) {
            alert("Event duration must be between 15 and 1440 minutes.");
            return;
        }

        const editingId = editingIdInput.value;

        const startMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
        const conflictingEvents = events.filter(function (existing) {
            if (existing.id === editingId || existing.date !== date ||
                existing.status === "rejected") return false;
            const existingStart = Number(existing.time.slice(0, 2)) * 60 +
                Number(existing.time.slice(3, 5));
            const existingEnd = existingStart + Number(existing.durationMinutes || 60);
            return startMinutes < existingEnd &&
                existingStart < startMinutes + durationMinutes;
        });
        if (conflictingEvents.length > 0) {
            const conflictSummary = conflictingEvents.map(function (conflict) {
                return conflict.title + " (" + conflict.time + ")";
            }).join(", ");
            if (!confirm("Schedule conflict on " + formatDate(date) + " with " +
                conflictSummary + ". Submit this event anyway?")) return;
        }

        const eventDetails = {
            title, category, date, time, venue, capacity, description, durationMinutes
        };
        const saveButton = document.getElementById("saveEventButton");
        saveButton.disabled = true;
        try {
            if (editingId) {
                await window.CampusAPI.updateEvent(editingId, eventDetails);
            } else {
                await window.CampusAPI.createEvent(eventDetails);
            }

            resetForm();
            formSection.hidden = true;
            await loadData();
            alert(editingId
                ? "Event updated and sent for approval."
                : "Event submitted. It will appear publicly after admin approval.");
        } catch (error) {
            alert(error.message);
        } finally {
            saveButton.disabled = false;
        }
    });

    function renderRegistrationOptions() {
        const previousValue = registrationSelect.value;

        registrationSelect.replaceChildren();

        const defaultOption = createElement("option", "", "Select an event");
        defaultOption.value = "";
        registrationSelect.appendChild(defaultOption);

        events.forEach(function (event) {
            const option = createElement("option", "", event.title);
            option.value = event.id;
            registrationSelect.appendChild(option);
        });

        if (events.some(function (event) {
            return event.id === previousValue;
        })) {
            registrationSelect.value = previousValue;
        }
    }

    async function renderRegistrations() {
        registrationList.replaceChildren();

        const eventId = registrationSelect.value;

        if (!eventId) {
            registrationList.appendChild(
                createElement(
                    "p",
                    "empty-state",
                    "Select an event to view its registered participants."
                )
            );
            return;
        }

        let registrations;
        try {
            registrations = await window.CampusAPI.eventRegistrations(eventId);
        } catch (error) {
            registrationList.appendChild(createElement("p", "empty-state", error.message));
            return;
        }

        if (registrations.length === 0) {
            registrationList.appendChild(
                createElement("p", "empty-state", "No registrations yet.")
            );
            return;
        }

        const table = document.createElement("table");
        table.className = "organizer-registration-table";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        ["Name", "Email", "Registration Date", "Attendance"].forEach(function (heading) {
            headerRow.appendChild(createElement("th", "", heading));
        });

        thead.appendChild(headerRow);

        const tbody = document.createElement("tbody");

        registrations.forEach(function (registration) {
            const row = document.createElement("tr");

            row.appendChild(
                createElement("td", "", registration.name || "Not provided")
            );
            row.appendChild(createElement("td", "",
                registration.attendedAt ? "Checked in" : "Not checked in"));

            row.appendChild(
                createElement("td", "", registration.email || "Not provided")
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    registration.registeredAt
                        ? formatDate(registration.registeredAt.slice(0, 10))
                        : "Not available"
                )
            );

            tbody.appendChild(row);
        });

        table.append(thead, tbody);
        registrationList.appendChild(table);
    }

    document.getElementById("showEventForm").addEventListener("click", function () {
        resetForm();
        openForm();
    });

    document.getElementById("cancelEventForm").addEventListener("click", function () {
        resetForm();
        formSection.hidden = true;
    });

    searchInput.addEventListener("input", renderEvents);
    registrationSelect.addEventListener("change", renderRegistrations);
    checkInForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const eventId = registrationSelect.value;
        const code = attendanceCodeInput.value.trim();
        if (!eventId) {
            checkInMessage.textContent = "Select an event before checking in an attendee.";
            return;
        }
        if (!code) return;
        try {
            const result = await window.CampusAPI.checkIn(eventId, code);
            checkInMessage.textContent = "Attendance verified for " + result.name + ".";
            attendanceCodeInput.value = "";
            await renderRegistrations();
        } catch (error) {
            checkInMessage.textContent = error.message;
        }
    });

    function stopScanner() {
        if (scannerTimer !== null) {
            window.clearInterval(scannerTimer);
            scannerTimer = null;
        }
        if (scannerStream) {
            scannerStream.getTracks().forEach(track => track.stop());
            scannerStream = null;
        }
        scannerVideo.srcObject = null;
        scannerVideo.hidden = true;
        document.getElementById("startQrScanner").hidden = false;
        document.getElementById("stopQrScanner").hidden = true;
    }

    document.getElementById("startQrScanner").addEventListener("click", async function () {
        if (!registrationSelect.value) {
            checkInMessage.textContent = "Select an event before starting the scanner.";
            return;
        }
        if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
            checkInMessage.textContent = "QR camera scanning is not supported in this browser. Enter the ticket code manually.";
            return;
        }
        try {
            const detector = new BarcodeDetector({ formats: ["qr_code"] });
            scannerStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            scannerVideo.srcObject = scannerStream;
            scannerVideo.hidden = false;
            await scannerVideo.play();
            this.hidden = true;
            document.getElementById("stopQrScanner").hidden = false;
            checkInMessage.textContent = "Point the camera at the student's QR ticket.";
            scannerTimer = window.setInterval(async function () {
                if (scannerBusy || scannerVideo.readyState < 2) return;
                scannerBusy = true;
                try {
                    const codes = await detector.detect(scannerVideo);
                    if (codes.length && codes[0].rawValue) {
                        attendanceCodeInput.value = codes[0].rawValue;
                        stopScanner();
                        checkInForm.requestSubmit();
                    }
                } catch (error) {
                    stopScanner();
                    checkInMessage.textContent = "QR scan failed: " + error.message;
                } finally {
                    scannerBusy = false;
                }
            }, 500);
        } catch (error) {
            stopScanner();
            checkInMessage.textContent = "Could not start the camera: " + error.message;
        }
    });
    document.getElementById("stopQrScanner").addEventListener("click", stopScanner);
    window.addEventListener("beforeunload", stopScanner);

    async function loadData() {
        try {
            [events, stats] = await Promise.all([
                window.CampusAPI.organizerEvents(),
                window.CampusAPI.organizerStats()
            ]);
            renderEvents();
            renderRegistrations();
        } catch (error) {
            eventList.replaceChildren(createElement("p", "empty-state",
                "Could not load organizer data: " + error.message));
            updateStats();
        }
    }

    loadData();
});
