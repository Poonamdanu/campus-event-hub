
const freeTimeForm = document.getElementById("freeTimeForm");
const freeTimeResults = document.getElementById("freeTimeResults");
const freeTimeEmpty = document.getElementById("freeTimeEmpty");
const freeTimeMessage = document.getElementById("freeTimeMessage");
const matchingEventCount = document.getElementById("matchingEventCount");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function formatDate(dateString) {
    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function renderEvents(events) {
    freeTimeResults.innerHTML = "";

    matchingEventCount.textContent =
        events.length + (events.length === 1
            ? " matching event found"
            : " matching events found");

    freeTimeEmpty.hidden = events.length !== 0;

    events.forEach(function (event) {
        const card = document.createElement("article");

        card.className = "free-time-event-card";

        card.innerHTML = `
            <div class="free-time-event-top">
                <span class="free-time-event-category">
                    ${escapeHTML(event.category)}
                </span>

                <span class="free-time-event-time">
                    ${escapeHTML(event.time)}
                </span>
            </div>

            <h3>${escapeHTML(event.title)}</h3>

            <p class="free-time-event-description">
                ${escapeHTML(event.description)}
            </p>

            <div class="free-time-event-details">
                <p>📅 ${escapeHTML(formatDate(event.date))}</p>
                <p>📍 ${escapeHTML(event.venue)}</p>
            </div>

            <a class="free-time-event-link" href="events.html">
                Explore Events →
            </a>
        `;

        freeTimeResults.appendChild(card);
    });
}

freeTimeForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const selectedDate =
        document.getElementById("availableDate").value;

    const startTime =
        document.getElementById("startTime").value;

    const endTime =
        document.getElementById("endTime").value;

    const selectedCategory =
        document.getElementById("freeTimeCategory").value;

    freeTimeMessage.textContent = "";

    if (!selectedDate || !startTime || !endTime) {
        freeTimeMessage.textContent =
            "Please select a date and your available time.";

        return;
    }

    if (startTime >= endTime) {
        freeTimeMessage.textContent =
            "End time must be later than start time.";

        return;
    }

    try {
        const allEvents = await window.CampusAPI.listEvents();
        const matchingEvents = allEvents.filter(function (event) {
            if (!event.date || !event.time) return false;

            const matchesDate = event.date === selectedDate;
            const matchesCategory = selectedCategory === "all" ||
                event.category.toLowerCase() === selectedCategory.toLowerCase();
            const eventStart = event.time.split(":").map(Number);
            const eventStartMinutes = eventStart[0] * 60 + eventStart[1];
            const availableStartMinutes = Number(startTime.slice(0, 2)) * 60 +
                Number(startTime.slice(3, 5));
            const availableEndMinutes = Number(endTime.slice(0, 2)) * 60 +
                Number(endTime.slice(3, 5));
            const matchesTime = eventStartMinutes >= availableStartMinutes &&
                eventStartMinutes + Number(event.durationMinutes || 60) <= availableEndMinutes;

            return matchesDate && matchesCategory && matchesTime;
        });

        renderEvents(matchingEvents);
    } catch (error) {
        freeTimeResults.replaceChildren();
        matchingEventCount.textContent = "Events unavailable";
        freeTimeEmpty.hidden = false;
        freeTimeEmpty.querySelector("h3").textContent = "Could Not Load Events";
        freeTimeEmpty.querySelector("p").textContent = error.message;
    }
});

document.getElementById("freeTimeYear").textContent =
    new Date().getFullYear();

freeTimeEmpty.hidden = true;
