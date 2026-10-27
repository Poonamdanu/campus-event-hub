
// ==============================
// EVENTORA - HOME PAGE
// ==============================

// Get the home page search form
const homeSearchForm = document.getElementById("homeSearchForm");
const homeSearchInput = document.getElementById("homeSearch");

// Handle event search
if (homeSearchForm && homeSearchInput) {
    homeSearchForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const searchQuery = homeSearchInput.value.trim();

        if (searchQuery === "") {
            homeSearchInput.focus();
            homeSearchInput.placeholder = "Enter an event name or category...";
            return;
        }

        const eventsPage = new URL("Pages/events.html", window.location.href);
        eventsPage.searchParams.set("search", searchQuery);

        window.location.href = eventsPage.href;
    });
}


// ==============================
// SMOOTH SCROLLING
// ==============================

document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
        const targetId = this.getAttribute("href");

        if (!targetId || targetId === "#") {
            return;
        }

        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            event.preventDefault();

            targetElement.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
});


// ==============================
// DASHBOARD SHORTCUTS
// ==============================

const dashboardCards = document.querySelectorAll(".dashboard-card");

dashboardCards.forEach(function (card, index) {
    card.style.animation = "slideUp 0.5s ease both";
    card.style.animationDelay = `${index * 0.08}s`;
});


// ==============================
// FOOTER YEAR
// ==============================

const copyright = document.querySelector(".copyright");

if (copyright) {
    copyright.textContent =
        `© ${new Date().getFullYear()} Eventora. All rights reserved.`;
}
