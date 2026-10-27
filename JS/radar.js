document.addEventListener("DOMContentLoaded", function () {
    const map = document.getElementById("campusMap");
    const mapState = document.getElementById("radarMapState");
    const eventList = document.getElementById("radarEventList");
    const detailsTitle = document.getElementById("radarDetailsTitle");
    const searchInput = document.getElementById("radarSearch");
    const categorySelect = document.getElementById("radarCategory");
    const positions = [
        [18, 27], [72, 23], [43, 46], [20, 76], [78, 72], [52, 16],
        [36, 76], [84, 45], [59, 83], [31, 16]
    ];
    let events = [];
    let selectedVenue = "";
    let loadError = "";

    function filteredEvents() {
        const query = searchInput.value.trim().toLowerCase();
        const category = categorySelect.value.toLowerCase();
        return events.filter(event =>
            (category === "all" || event.category.toLowerCase() === category) &&
            (!query || [event.title, event.description, event.category, event.venue, event.organizer]
                .some(value => String(value || "").toLowerCase().includes(query)))
        );
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function renderDetails(venue, venueEvents) {
        selectedVenue = venue;
        detailsTitle.textContent = venue || "Choose a venue";
        eventList.replaceChildren();

        if (!venueEvents.length) {
            eventList.appendChild(makeElement("p", "radar-state",
                venue ? "No matching events at this venue." : "Select a marker on the map to view its events."));
            return;
        }

        venueEvents.forEach(event => {
            const card = makeElement("a", "radar-event");
            card.href = "events.html?search=" + encodeURIComponent(event.title);
            const title = makeElement("strong", "", event.title);
            const details = makeElement("span", "",
                `${event.category} · ${event.date} · ${event.time}`);
            const capacity = makeElement("span", "",
                `${event.remainingCapacity} of ${event.capacity} spots left · ${event.organizer}`);
            const description = makeElement("span", "", event.description);
            card.append(title, details, capacity, description);
            eventList.appendChild(card);
        });
    }

    function renderMap() {
        map.querySelectorAll(".map-pin").forEach(marker => marker.remove());
        if (loadError) {
            mapState.hidden = false;
            mapState.textContent = "Could not load campus events: " + loadError;
            detailsTitle.textContent = "Events unavailable";
            eventList.replaceChildren(makeElement("p", "radar-state", "Check the API connection and reload this page."));
            return;
        }

        const visibleEvents = filteredEvents();
        const venues = Array.from(new Set(visibleEvents.map(event => event.venue)));

        if (!venues.length) {
            renderDetails("", []);
            detailsTitle.textContent = "No matching venues";
            eventList.replaceChildren(makeElement("p", "radar-state",
                "Try another search or category."));
            mapState.hidden = false;
            mapState.textContent = "No events match these filters.";
            return;
        }

        mapState.hidden = true;
        venues.forEach((venue, index) => {
            const venueEvents = visibleEvents.filter(event => event.venue === venue);
            const marker = makeElement("button", "map-pin");
            const position = positions[index % positions.length];
            marker.type = "button";
            marker.style.left = position[0] + "%";
            marker.style.top = position[1] + "%";
            marker.setAttribute("aria-pressed", String(venue === selectedVenue));
            marker.setAttribute("aria-label",
                `${venue}, ${venueEvents.length} ${venueEvents.length === 1 ? "event" : "events"}`);
            marker.append(
                makeElement("span", "", venue),
                makeElement("span", "map-pin-count", `${venueEvents.length} ${venueEvents.length === 1 ? "event" : "events"}`)
            );
            marker.addEventListener("click", () => {
                selectedVenue = venue;
                renderMap();
            });
            map.appendChild(marker);
        });

        if (selectedVenue && venues.includes(selectedVenue)) {
            renderDetails(selectedVenue, visibleEvents.filter(event => event.venue === selectedVenue));
        } else {
            renderDetails("", []);
        }
    }

    searchInput.addEventListener("input", renderMap);
    categorySelect.addEventListener("change", renderMap);

    window.CampusAPI.listEvents()
        .then(data => {
            events = data;
            renderMap();
        })
        .catch(error => {
            loadError = error.message;
            renderMap();
        });
});
