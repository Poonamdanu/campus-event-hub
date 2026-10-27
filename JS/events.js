
document.addEventListener("DOMContentLoaded", function () {
    const bookmarksKey = "eventoraBookmarks";

    const eventsGrid = document.getElementById("eventsGrid");
    const searchForm = document.getElementById("eventSearchForm");
    const searchInput = document.getElementById("eventSearch");
    const eventCount = document.getElementById("eventCount");
    const noEvents = document.getElementById("noEvents");
    const clearFiltersButton = document.getElementById("clearFilters");
    const sortSelect = document.getElementById("eventSort");

    // Support both existing and alternate modal IDs.
    const detailsModal =
        document.getElementById("eventDetailsModal") ||
        document.getElementById("eventModal");

    const registrationModal =
        document.getElementById("registrationModal");

    let activeCategory = "All";
    let selectedEvent = null;
    let events = [];
    let registrations = [];

    function readStorage(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function getAllEvents() {
        return events;
    }

    function formatDate(date) {
        if (!date) return "Date to be announced";

        const parsed = new Date(date + "T00:00:00");

        if (Number.isNaN(parsed.getTime())) return date;

        return parsed.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function formatTime(time) {
        if (!time) return "Time to be announced";

        const parts = String(time).split(":");
        let hours = Number(parts[0]);
        const minutes = parts[1] || "00";
        const period = hours >= 12 ? "PM" : "AM";

        hours = hours % 12 || 12;

        return hours + ":" + minutes + " " + period;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[character];
        });
    }

    function getRegistrations() {
        return registrations;
    }

    function getBookmarks() {
        return readStorage(bookmarksKey);
    }

    function saveBookmarks(bookmarks) {
        localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
    }

    function isRegistered(eventId) {
        return getRegistrations().some(function (registration) {
            return registration.eventId === eventId;
        });
    }

    function createEventCard(event) {
        const card = document.createElement("article");
        card.className = "event-card";
        card.dataset.eventId = event.id;

        const category = document.createElement("span");
        category.className = "event-category";
        category.textContent = event.category;

        const title = document.createElement("h3");
        title.textContent = event.title;

        const date = document.createElement("p");
        date.textContent = "📅 " + formatDate(event.date);

        const time = document.createElement("p");
        time.textContent = "🕒 " + formatTime(event.time);

        const venue = document.createElement("p");
        venue.textContent = "📍 " + event.venue;

        const availability = document.createElement("p");
        availability.textContent = "👥 " +
            (event.remainingCapacity === 0
                ? "Fully booked"
                : `${event.remainingCapacity} of ${event.capacity} spots left`);

        const description = document.createElement("p");
        description.className = "event-description";
        description.textContent = event.description;

        const actions = document.createElement("div");
        actions.className = "event-card-actions";

        const detailsButton = document.createElement("button");
        detailsButton.type = "button";
        detailsButton.className = "btn btn-primary";
        detailsButton.textContent = "View Details";

        detailsButton.addEventListener("click", function () {
            openDetails(event.id);
        });

        const bookmarkButton = document.createElement("button");
        bookmarkButton.type = "button";
        bookmarkButton.className = "bookmark-button";

        function updateBookmarkButton() {
            const bookmarked = getBookmarks().includes(event.id);
            bookmarkButton.textContent = bookmarked ? "♥ Saved" : "♡ Save";
            bookmarkButton.setAttribute("aria-pressed", String(bookmarked));
        }

        bookmarkButton.addEventListener("click", function () {
            let bookmarks = getBookmarks();

            if (bookmarks.includes(event.id)) {
                bookmarks = bookmarks.filter(id => id !== event.id);
            } else {
                bookmarks.push(event.id);
            }

            saveBookmarks(bookmarks);
            updateBookmarkButton();
        });

        updateBookmarkButton();

        actions.append(detailsButton, bookmarkButton);
        card.append(category, title, date, time, venue, availability, description, actions);

        return card;
    }

    function renderEvents() {
        if (!eventsGrid) return;

        const allEvents = getAllEvents();
        const searchText = searchInput ? searchInput.value.trim().toLowerCase() : "";

        let filteredEvents = allEvents.filter(function (event) {
            const matchesCategory =
                activeCategory === "All" ||
                event.category.toLowerCase() === activeCategory.toLowerCase();

            const searchableText = [
                event.title,
                event.category,
                event.venue,
                event.description,
                event.organizer
            ].join(" ").toLowerCase();

            return matchesCategory && searchableText.includes(searchText);
        });

        const sortValue = sortSelect ? sortSelect.value : "date";

        if (sortValue === "name" || sortValue === "title") {
            filteredEvents.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortValue === "category") {
            filteredEvents.sort((a, b) => a.category.localeCompare(b.category));
        } else {
            filteredEvents.sort((a, b) => a.date.localeCompare(b.date));
        }

        eventsGrid.replaceChildren();

        filteredEvents.forEach(function (event) {
            eventsGrid.appendChild(createEventCard(event));
        });

        if (eventCount) {
            eventCount.textContent = filteredEvents.length +
                (filteredEvents.length === 1 ? " event" : " events");
        }

        if (noEvents) {
            noEvents.hidden = filteredEvents.length > 0;
        }

        eventsGrid.hidden = filteredEvents.length === 0;

        // Keep calendar and daily agenda synchronized.
        renderCalendar();
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value || "Not available";
    }

    function populateRegistrationIdentity() {
        const user = window.CampusAPI.currentUser();
        const isStudent = user && user.role === "student" &&
            localStorage.getItem("eventoraToken");
        const nameInput = document.getElementById("registrationName") ||
            document.getElementById("participantName");
        const emailInput = document.getElementById("registrationEmail") ||
            document.getElementById("participantEmail");

        [nameInput, emailInput].filter(Boolean).forEach(input => {
            input.readOnly = true;
            input.required = false;
        });
        if (nameInput) {
            nameInput.value = isStudent ? user.name : "";
            nameInput.placeholder = isStudent ? "" : "Log in with a student account to register";
        }
        if (emailInput) {
            emailInput.value = isStudent ? user.email : "";
            emailInput.placeholder = isStudent ? "" : "Log in with a student account to register";
        }
    }

    function openDetails(eventId) {
        selectedEvent = getAllEvents().find(event => event.id === eventId);

        if (!selectedEvent) return;
        populateRegistrationIdentity();

        // IDs used by the existing events.html modal.
        setText("detailsTitle", selectedEvent.title);
        setText("detailsCategory", selectedEvent.category);
        setText("detailsDate", formatDate(selectedEvent.date));
        setText("detailsTime", formatTime(selectedEvent.time));
        setText("detailsVenue", selectedEvent.venue);
        setText("detailsDescription", selectedEvent.description);

        // IDs used by the newer modal markup.
        setText("modalEventTitle", selectedEvent.title);
        setText("modalEventCategory", selectedEvent.category);
        setText("modalEventDate", formatDate(selectedEvent.date));
        setText("modalEventTime", formatTime(selectedEvent.time));
        setText("modalEventVenue", selectedEvent.venue);
        setText(
            "modalEventCapacity",
            selectedEvent.remainingCapacity === 0
                ? "Fully booked"
                : `${selectedEvent.remainingCapacity} of ${selectedEvent.capacity} spots left`
        );
        setText("modalEventOrganizer", selectedEvent.organizer || "Campus Organizer");
        setText("modalEventRules", selectedEvent.rules || "Follow the organizer's instructions.");
        setText("modalEventDescription", selectedEvent.description);

        const registerButton = document.getElementById("openRegistration");
        const alreadyRegistered = isRegistered(selectedEvent.id);
        const isFull = selectedEvent.remainingCapacity === 0;
        const inlineRegistration = document.getElementById("eventRegistrationPanel");

        if (registerButton) {
            registerButton.textContent = alreadyRegistered
                ? "Already Registered"
                : isFull ? "Event Full" : "Register for this Event";
            registerButton.disabled = alreadyRegistered || isFull;
            registerButton.setAttribute("aria-expanded", "false");
        }
        if (inlineRegistration) {
            inlineRegistration.hidden = true;
        }

        const registrationMessage = document.getElementById("registrationMessage");
        const registrationSubmit = registrationForm &&
            registrationForm.querySelector('[type="submit"]');
        const registrationFields = registrationForm
            ? registrationForm.querySelectorAll("input:not([type='hidden'])")
            : [];
        if (registrationMessage) {
            registrationMessage.textContent = alreadyRegistered
                ? "You are already registered for this event."
                : isFull ? "This event has reached its capacity." : "";
        }
        registrationFields.forEach(input => {
            input.disabled = alreadyRegistered || isFull;
        });
        if (registrationSubmit) registrationSubmit.disabled = alreadyRegistered || isFull;

        const modalRegistrationId = document.getElementById("registrationEventId");
        if (modalRegistrationId) modalRegistrationId.value = selectedEvent.id;

        if (detailsModal) {
            detailsModal.hidden = false;
        }
    }

    function closeModal(modal) {
        if (modal) modal.hidden = true;
    }

    function openRegistrationForm() {
        if (!selectedEvent || isRegistered(selectedEvent.id)) return;
        populateRegistrationIdentity();

        const inlineRegistration = document.getElementById("eventRegistrationPanel");

        if (inlineRegistration) {
            inlineRegistration.hidden = false;
            const registerButton = document.getElementById("openRegistration");
            if (registerButton) {
                registerButton.textContent = "Hide Registration Form";
                registerButton.setAttribute("aria-expanded", "true");
            }
            inlineRegistration.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }

    async function registerForEvent(event) {
        event.preventDefault();

        if (!selectedEvent) return;

        const user = window.CampusAPI.currentUser();
        if (!user || user.role !== "student" || !localStorage.getItem("eventoraToken")) {
            alert("Please log in with a student account to register for events.");
            window.location.href = "login.html";
            return;
        }

        const submitButton = registrationForm.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        try {
            const registrationsForDay = await window.CampusAPI.myRegistrations();
            const [newHour, newMinute] = selectedEvent.time.split(":").map(Number);
            const newStart = newHour * 60 + newMinute;
            const newEnd = newStart + (Number(selectedEvent.durationMinutes) || 60);
            const conflicts = registrationsForDay.filter(registration => {
                if (registration.eventDate !== selectedEvent.date) return false;
                const [hour, minute] = registration.eventTime.split(":").map(Number);
                const start = hour * 60 + minute;
                const end = start + (Number(registration.durationMinutes) || 60);
                return newStart < end && start < newEnd;
            });
            if (conflicts.length) {
                const conflictNames = conflicts.map(item =>
                    `${item.eventTitle} (${item.eventTime})`
                ).join(", ");
                if (!window.confirm(
                    `Schedule conflict: this event overlaps with ${conflictNames}. Register anyway?`
                )) return;
            }

            await window.CampusAPI.register(selectedEvent.id, {});
            [events, registrations] = await Promise.all([
                window.CampusAPI.listEvents(),
                window.CampusAPI.myRegistrations()
            ]);
            window.CampusEvents = events;

            if (registrationForm) registrationForm.reset();
            closeModal(registrationModal);
            closeModal(detailsModal);
            renderEvents();

            alert("Registration saved. You can see it in the Student Dashboard.");
        } catch (error) {
            alert(error.message);
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    }

    // ---------------- Calendar ----------------

    const calendarDays = document.getElementById("calendarDays");
    const calendarMonthYear = document.getElementById("calendarMonthYear");
    const calendarAgendaList = document.getElementById("calendarAgendaList");
    const agendaSelectedDate = document.getElementById("agendaSelectedDate");
    const agendaEventCount = document.getElementById("agendaEventCount");
    const calendarPrev = document.getElementById("calendarPrev");
    const calendarNext = document.getElementById("calendarNext");
    const calendarSearch = document.getElementById("calendarSearch");
    const calendarCategory = document.getElementById("calendarCategory");

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const today = new Date();

    let calendarYear = today.getFullYear();
    let calendarMonth = today.getMonth();
    let selectedDate = makeDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    function makeDateKey(year, month, day) {
        return year + "-" +
            String(month + 1).padStart(2, "0") + "-" +
            String(day).padStart(2, "0");
    }

    function getCalendarEvents() {
        const query = calendarSearch ? calendarSearch.value.trim().toLowerCase() : "";
        const category = calendarCategory ? calendarCategory.value : "All";

        return getAllEvents().filter(function (event) {
            const matchesCategory =
                category === "All" ||
                event.category.toLowerCase() === category.toLowerCase();

            const searchable = [
                event.title,
                event.category,
                event.venue,
                event.description,
                event.organizer
            ].join(" ").toLowerCase();

            return matchesCategory && searchable.includes(query);
        });
    }

    function categoryDotClass(category) {
        const value = String(category || "").toLowerCase();

        if (value.includes("cultural")) return "cultural";
        if (value.includes("sport")) return "sports";
        if (value.includes("workshop")) return "workshop";
        if (value.includes("music")) return "music";

        return "";
    }

    function makeCalendarElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;

        return element;
    }

    function renderCalendar() {
        if (!calendarDays || !calendarMonthYear) return;

        calendarMonthYear.textContent =
            monthNames[calendarMonth] + " " + calendarYear;

        calendarDays.replaceChildren();

        const firstDay = new Date(calendarYear, calendarMonth, 1);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
        const previousMonthDays = new Date(calendarYear, calendarMonth, 0).getDate();

        const events = getCalendarEvents();

        for (let index = 0; index < 42; index++) {
            let day;
            let month = calendarMonth;
            let year = calendarYear;
            let otherMonth = false;

            if (index < startOffset) {
                day = previousMonthDays - startOffset + index + 1;
                month--;

                if (month < 0) {
                    month = 11;
                    year--;
                }

                otherMonth = true;
            } else if (index >= startOffset + daysInMonth) {
                day = index - startOffset - daysInMonth + 1;
                month++;

                if (month > 11) {
                    month = 0;
                    year++;
                }

                otherMonth = true;
            } else {
                day = index - startOffset + 1;
            }

            const key = makeDateKey(year, month, day);
            const dayEvents = events.filter(event => event.date === key);

            const button = makeCalendarElement("button", "calendar-day");
            button.type = "button";
            button.setAttribute("aria-label", monthNames[month] + " " + day + ", " + year);

            button.appendChild(makeCalendarElement("span", "", String(day)));

            const dots = makeCalendarElement("span", "calendar-event-dots");

            dayEvents.slice(0, 3).forEach(function (event) {
                dots.appendChild(makeCalendarElement(
                    "i",
                    "calendar-event-dot " + categoryDotClass(event.category)
                ));
            });

            button.appendChild(dots);

            if (otherMonth) button.classList.add("other-month");

            if (key === makeDateKey(today.getFullYear(), today.getMonth(), today.getDate())) {
                button.classList.add("today");
            }

            if (key === selectedDate) button.classList.add("selected");
            if (dayEvents.length) button.classList.add("has-event");

            button.addEventListener("click", function () {
                selectedDate = key;
                calendarYear = year;
                calendarMonth = month;

                renderCalendar();
                renderAgenda();
            });

            calendarDays.appendChild(button);
        }
    }

    function renderAgenda() {
        if (!calendarAgendaList || !agendaSelectedDate || !agendaEventCount) return;

        const [year, month, day] = selectedDate.split("-").map(Number);
        const date = new Date(year, month - 1, day);

        agendaSelectedDate.textContent = date.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long"
        });

        const events = getCalendarEvents().filter(event => event.date === selectedDate);

        agendaEventCount.textContent = events.length === 1
            ? "1 event scheduled"
            : events.length + " events scheduled";

        calendarAgendaList.replaceChildren();

        if (!events.length) {
            const empty = makeCalendarElement("div", "agenda-empty");

            empty.appendChild(makeCalendarElement("span", "empty-icon", "🌙"));
            empty.appendChild(makeCalendarElement("h4", "", "A little breathing room"));
            empty.appendChild(makeCalendarElement(
                "p",
                "",
                "No matching events on this date. Select another day or change your filters."
            ));

            calendarAgendaList.appendChild(empty);
            return;
        }

        events.forEach(function (event) {
            const card = makeCalendarElement("article", "agenda-event");
            const dateBox = makeCalendarElement("div", "agenda-event-date");

            dateBox.appendChild(makeCalendarElement("strong", "", String(day)));
            dateBox.appendChild(makeCalendarElement(
                "span", "", monthNames[month - 1].slice(0, 3)
            ));

            const content = makeCalendarElement("div", "agenda-event-content");

            content.appendChild(makeCalendarElement(
                "span", "agenda-category", event.category
            ));

            content.appendChild(makeCalendarElement("h4", "", event.title));
            content.appendChild(makeCalendarElement(
                "p", "", "🕒 " + formatTime(event.time)
            ));
            content.appendChild(makeCalendarElement("p", "", "📍 " + event.venue));

            const button = makeCalendarElement("button", "", "View Details →");
            button.type = "button";

            button.addEventListener("click", function () {
                openDetails(event.id);

                if (!detailsModal) {
                    const cardElement = document.querySelector(
                        '#eventsGrid [data-event-id="' + CSS.escape(event.id) + '"]'
                    );

                    if (cardElement) {
                        cardElement.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });
                    }
                }
            });

            content.appendChild(button);
            card.append(dateBox, content);
            calendarAgendaList.appendChild(card);
        });
    }

    if (calendarPrev) {
        calendarPrev.addEventListener("click", function () {
            calendarMonth--;

            if (calendarMonth < 0) {
                calendarMonth = 11;
                calendarYear--;
            }

            renderCalendar();
        });
    }

    if (calendarNext) {
        calendarNext.addEventListener("click", function () {
            calendarMonth++;

            if (calendarMonth > 11) {
                calendarMonth = 0;
                calendarYear++;
            }

            renderCalendar();
        });
    }

    if (calendarSearch) {
        calendarSearch.addEventListener("input", function () {
            renderCalendar();
            renderAgenda();
        });
    }

    if (calendarCategory) {
        calendarCategory.addEventListener("change", function () {
            renderCalendar();
            renderAgenda();
        });
    }

    // ---------------- Existing explorer controls ----------------

    if (searchForm) {
        searchForm.addEventListener("submit", function (event) {
            event.preventDefault();
            renderEvents();
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", renderEvents);
    }

    if (sortSelect) {
        sortSelect.addEventListener("change", renderEvents);
    }

    document.querySelectorAll("#categoryFilters [data-category]").forEach(function (button) {
        button.addEventListener("click", function () {
            activeCategory = button.dataset.category;

            document.querySelectorAll("#categoryFilters [data-category]").forEach(function (item) {
                item.classList.toggle("active", item === button);
            });

            renderEvents();
        });
    });

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener("click", function () {
            activeCategory = "All";

            if (searchInput) searchInput.value = "";
            if (sortSelect) sortSelect.value = "date";

            document.querySelectorAll("#categoryFilters [data-category]").forEach(function (button) {
                button.classList.toggle("active", button.dataset.category === "All");
            });

            renderEvents();
        });
    }

    document.querySelectorAll("[data-close-modal]").forEach(function (button) {
        button.addEventListener("click", function () {
            const modal = button.closest(".event-modal, .modal");

            if (modal) closeModal(modal);
        });
    });

    const openRegistrationButton = document.getElementById("openRegistration");

    if (openRegistrationButton) {
        openRegistrationButton.addEventListener("click", function () {
            const inlineRegistration = document.querySelector(".modal-registration");
            if (inlineRegistration && !inlineRegistration.hidden) {
                inlineRegistration.hidden = true;
                openRegistrationButton.textContent = "Register for this Event";
                openRegistrationButton.setAttribute("aria-expanded", "false");
                return;
            }
            openRegistrationForm();
        });
    }

    const registrationForm =
        document.getElementById("registrationForm") ||
        document.getElementById("eventRegistrationForm");

    if (registrationForm) {
        registrationForm.addEventListener("submit", registerForEvent);
    }

    const params = new URLSearchParams(window.location.search);

    if (searchInput && params.has("search")) {
        searchInput.value = params.get("search");
    }

    if (params.has("category")) {
        activeCategory = params.get("category");
    }

    async function loadEvents() {
        try {
            events = await window.CampusAPI.listEvents();
            window.CampusEvents = events;
            const user = window.CampusAPI.currentUser();
            if (user && user.role === "student" && localStorage.getItem("eventoraToken")) {
                try {
                    registrations = await window.CampusAPI.myRegistrations();
                } catch (error) {
                    if (error.status !== 401) throw error;
                    localStorage.removeItem("eventoraToken");
                    localStorage.removeItem("eventoraUser");
                    registrations = [];
                }
            } else {
                registrations = [];
            }
            renderEvents();
            renderAgenda();
        } catch (error) {
            eventsGrid.replaceChildren();
            eventsGrid.hidden = false;
            const message = document.createElement("p");
            message.className = "empty-state";
            message.textContent = "Could not load events: " + error.message;
            eventsGrid.appendChild(message);
            if (eventCount) eventCount.textContent = "Events unavailable";
            if (noEvents) noEvents.hidden = true;
        }
    }

    loadEvents();
});
