(function () {
    const liveServerApi = window.location.port === "5500"
        ? `${window.location.protocol}//${window.location.hostname}:3000/api`
        : "/api";
    const baseUrl = window.CAMPUS_EVENT_API_URL || liveServerApi;
    const tokenKey = "eventoraToken";

    async function request(path, options = {}) {
        const headers = { ...options.headers };
        const token = localStorage.getItem(tokenKey);
        if (token) headers.Authorization = "Bearer " + token;
        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(baseUrl + path, {
            ...options,
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body)
        });

        if (response.status === 204) return null;

        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const error = new Error(data && data.error
                ? data.error
                : `Request failed with status ${response.status}.`);
            error.status = response.status;
            throw error;
        }
        return data;
    }

    function requestArray(path) {
        return request(path).then(data => {
            if (!Array.isArray(data)) {
                throw new Error("The server returned an invalid list response.");
            }
            return data;
        });
    }

    function currentUser() {
        try {
            return JSON.parse(localStorage.getItem("eventoraUser") || "null");
        } catch (error) {
            return null;
        }
    }

    window.CampusAPI = {
        signup(details) {
            return request("/auth/signup", { method: "POST", body: details });
        },
        login(details) {
            return request("/auth/login", { method: "POST", body: details });
        },
        currentUser,
        me() {
            return request("/auth/me");
        },
        logout() {
            return request("/auth/logout", { method: "POST" });
        },
        listEvents() {
            return requestArray("/events");
        },
        myRegistrations() {
            return requestArray("/my-registrations");
        },
        register(eventId, details) {
            return request("/events/" + encodeURIComponent(eventId) + "/register", {
                method: "POST",
                body: details
            });
        },
        organizerEvents() {
            return requestArray("/organizer/events");
        },
        createEvent(event) {
            return request("/organizer/events", { method: "POST", body: event });
        },
        updateEvent(eventId, event) {
            return request("/organizer/events/" + encodeURIComponent(eventId), {
                method: "PUT",
                body: event
            });
        },
        deleteEvent(eventId) {
            return request("/organizer/events/" + encodeURIComponent(eventId), {
                method: "DELETE"
            });
        },
        eventRegistrations(eventId) {
            return requestArray("/organizer/events/" + encodeURIComponent(eventId) + "/registrations");
        },
        checkIn(eventId, code) {
            return request("/organizer/events/" + encodeURIComponent(eventId) + "/check-in", {
                method: "POST",
                body: { code }
            });
        },
        organizerStats() {
            return request("/organizer/stats");
        },
        adminEvents() {
            return requestArray("/admin/events");
        },
        adminRegistrations() {
            return requestArray("/admin/registrations");
        },
        adminStats() {
            return request("/admin/stats");
        },
        myFeedback() {
            return requestArray("/my-feedback");
        },
        submitFeedback(feedback) {
            return request("/feedback", { method: "POST", body: feedback });
        },
        adminFeedback() {
            return requestArray("/admin/feedback");
        },
        setFeedbackStatus(feedbackId, status) {
            return request("/admin/feedback/" + encodeURIComponent(feedbackId) + "/status", {
                method: "PATCH",
                body: { status }
            });
        },
        respondToFeedback(feedbackId, responseText) {
            return request("/admin/feedback/" + encodeURIComponent(feedbackId) + "/response", {
                method: "PATCH",
                body: { response: responseText }
            });
        },
        setEventStatus(eventId, status) {
            return request("/admin/events/" + encodeURIComponent(eventId) + "/status", {
                method: "PATCH",
                body: { status }
            });
        }
    };
})();
