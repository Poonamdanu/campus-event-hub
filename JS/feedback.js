
document.addEventListener("DOMContentLoaded", function () {
    const feedbackForm = document.getElementById("feedbackForm");
    const feedbackList = document.getElementById("myFeedbackList");
    const messageElement = document.getElementById("feedbackFormMessage");

    const nameInput = document.getElementById("feedbackName");
    const emailInput = document.getElementById("feedbackEmail");
    const typeInput = document.getElementById("feedbackType");
    const eventInput = document.getElementById("feedbackEvent");
    const ratingInput = document.getElementById("feedbackRating");
    const messageInput = document.getElementById("feedbackMessage");
    let feedback = [];
    const user = window.CampusAPI.currentUser();
    if (user) {
        nameInput.value = user.name || "";
        emailInput.value = user.email || "";
        nameInput.readOnly = true;
        emailInput.readOnly = true;
    }

    const categories = [
        "Suggestion",
        "Complaint",
        "Event Review",
        "Technical Issue",
        "Appreciation"
    ];

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
            return "Date unavailable";
        }

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "Date unavailable";
        }

        return parsedDate.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function renderFeedback() {
        feedbackList.replaceChildren();

        const entries = feedback.slice().reverse();

        if (entries.length === 0) {
            feedbackList.appendChild(
                createElement(
                    "p",
                    "feedback-empty-state",
                    "You haven't submitted any feedback yet."
                )
            );

            return;
        }

        entries.forEach(function (item) {
            const card = createElement("article", "my-feedback-card");

            const heading = createElement(
                "h3",
                "",
                item.type || "Feedback"
            );

            const status = createElement(
                "span",
                "feedback-status",
                item.status || "Submitted"
            );

            const message = createElement(
                "p",
                "my-feedback-message",
                item.message || ""
            );

            const details = createElement(
                "p",
                "my-feedback-details",
                "Event: " + (item.eventName || "Not specified")
            );

            const rating = createElement(
                "p",
                "my-feedback-rating",
                item.rating
                    ? "Rating: " + "⭐".repeat(Number(item.rating))
                    : "No rating provided"
            );

            const date = createElement(
                "small",
                "my-feedback-date",
                formatDate(item.submittedAt)
            );
            const response = createElement(
                "p",
                "my-feedback-response",
                item.adminResponse
                    ? "Admin response: " + item.adminResponse
                    : "No admin response yet."
            );

            const header = createElement("div", "my-feedback-header");
            header.append(heading, status);

            card.append(header, message, details, rating, response, date);
            feedbackList.appendChild(card);
        });
    }

    function renderBarChart(containerId, items, colorClass) {
        const container = document.getElementById(containerId);

        if (!container) {
            return;
        }

        container.replaceChildren();

        const maxValue = Math.max(
            1,
            ...items.map(function (item) {
                return item.value;
            })
        );

        const hasData = items.some(function (item) {
            return item.value > 0;
        });

        if (!hasData) {
            container.appendChild(
                createElement(
                    "p",
                    "feedback-chart-empty",
                    "No data available yet. Submit feedback to see the graph."
                )
            );

            return;
        }

        items.forEach(function (item) {
            const row = createElement("div", "feedback-bar-row");

            const top = createElement("div", "feedback-bar-top");

            const label = createElement(
                "span",
                "feedback-bar-label",
                item.label
            );

            const value = createElement(
                "span",
                "feedback-bar-value",
                String(item.value)
            );

            top.append(label, value);

            const track = createElement("div", "feedback-bar-track");

            const bar = createElement(
                "div",
                "feedback-bar-fill " + colorClass
            );

            const width = item.value === 0
                ? 0
                : Math.max(3, (item.value / maxValue) * 100);

            bar.style.width = width + "%";
            bar.setAttribute("role", "img");
            bar.setAttribute(
                "aria-label",
                item.label + ": " + item.value
            );

            track.appendChild(bar);
            row.append(top, track);
            container.appendChild(row);
        });
    }

    function renderAnalytics() {
        const total = feedback.length;

        const ratings = feedback
            .map(function (item) {
                return Number(item.rating);
            })
            .filter(function (rating) {
                return Number.isInteger(rating) &&
                    rating >= 1 &&
                    rating <= 5;
            });

        const average = ratings.length
            ? (
                ratings.reduce(function (sum, rating) {
                    return sum + rating;
                }, 0) / ratings.length
            ).toFixed(1)
            : "N/A";

        const categoryCounts = {};

        categories.forEach(function (category) {
            categoryCounts[category] = 0;
        });

        feedback.forEach(function (item) {
            const category = item.type || "Other";

            categoryCounts[category] =
                (categoryCounts[category] || 0) + 1;
        });

        const categoryTotal = Object.keys(categoryCounts).filter(
            function (category) {
                return categoryCounts[category] > 0;
            }
        ).length;

        const submittedCount = feedback.filter(function (item) {
            return (item.status || "Submitted").toLowerCase() === "submitted";
        }).length;

        document.getElementById("analyticsTotal").textContent = total;

        document.getElementById("analyticsAverage").textContent = average;

        document.getElementById("analyticsSubmitted").textContent =
            submittedCount;

        document.getElementById("analyticsCategories").textContent =
            categoryTotal;

        renderBarChart(
            "categoryChart",
            categories.map(function (category) {
                return {
                    label: category,
                    value: categoryCounts[category] || 0
                };
            }),
            "category-bar"
        );

        renderBarChart(
            "ratingChart",
            [5, 4, 3, 2, 1].map(function (rating) {
                return {
                    label: rating + " Star" + (rating === 1 ? "" : "s"),
                    value: ratings.filter(function (value) {
                        return value === rating;
                    }).length
                };
            }),
            "rating-bar"
        );

        const statuses = ["Submitted", "Under Review", "Resolved", "Closed"];

        renderBarChart(
            "statusChart",
            statuses.map(function (status) {
                return {
                    label: status,
                    value: feedback.filter(function (item) {
                        return (item.status || "Submitted").toLowerCase() ===
                            status.toLowerCase();
                    }).length
                };
            }),
            "status-bar"
        );
    }

    feedbackForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const type = typeInput.value;
        const eventName = eventInput.value.trim();
        const rating = ratingInput.value;
        const message = messageInput.value.trim();

        if (!type || message.length < 10) {
            messageElement.textContent =
                "Choose a feedback type and enter at least 10 characters.";

            messageElement.className = "feedback-form-message error";
            return;
        }

        const submitButton = feedbackForm.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        try {
            await window.CampusAPI.submitFeedback({
                type,
                eventName,
                rating,
                message
            });
            feedbackForm.reset();
            nameInput.value = user ? user.name : "";
            emailInput.value = user ? user.email : "";
            messageElement.textContent = "Your feedback has been submitted successfully.";
            messageElement.className = "feedback-form-message success";
            await loadFeedback();
        } catch (error) {
            messageElement.textContent = error.message;
            messageElement.className = "feedback-form-message error";
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });

    async function loadFeedback() {
        try {
            feedback = await window.CampusAPI.myFeedback();
            renderFeedback();
            renderAnalytics();
        } catch (error) {
            feedbackList.replaceChildren(
                createElement("p", "feedback-empty-state", "Could not load feedback: " + error.message)
            );
            messageElement.textContent = error.message;
            messageElement.className = "feedback-form-message error";
        }
    }

    loadFeedback();
});
