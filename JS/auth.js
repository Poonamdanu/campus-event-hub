(function () {
    const CURRENT_USER_KEY = "eventoraUser";
    const TOKEN_KEY = "eventoraToken";
    const rolePages = {
        student: "dashboard.html",
        organizer: "organizer-dashboard.html",
        admin: "admin-dashboard.html"
    };

    localStorage.removeItem("eventoraUsers");

    function currentPage() {
        return window.location.pathname.split("/").pop().toLowerCase();
    }

    function portalUrl(role) {
        const page = rolePages[role] || "portal.html";
        return currentPage() === "index.html" || !window.location.pathname.toLowerCase().includes("/pages/")
            ? "Pages/" + page
            : page;
    }

    function showMessage(message, type) {
        const messageBox = document.getElementById("authMessage") ||
            document.getElementById("signupMessage") ||
            document.getElementById("loginMessage");
        if (!messageBox) return;
        messageBox.textContent = message;
        messageBox.className = "form-message " + (type === "success" ? "success" : "error");
    }

    function setCurrentUser(session) {
        localStorage.setItem(TOKEN_KEY, session.token);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session.user));
    }

    function redirectForRole(role) {
        window.location.href = portalUrl(role);
    }

    function fieldValue(id) {
        const field = document.getElementById(id);
        return field ? field.value.trim() : "";
    }

    function passwordValue(id) {
        const field = document.getElementById(id);
        return field ? field.value : "";
    }

    async function handleSignup(event) {
        event.preventDefault();
        const name = fieldValue("fullName");
        const email = fieldValue("signupEmail").toLowerCase();
        const password = passwordValue("signupPassword");
        const confirmPassword = passwordValue("confirmPassword");
        const role = fieldValue("accountRole") || "student";

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.", "error");
            return;
        }

        const details = {
            name,
            email,
            password,
            role,
            college: fieldValue("collegeName"),
            collegeId: fieldValue("collegeId"),
            adminKey: fieldValue("adminSignupKey")
        };
        const button = event.submitter;
        if (button) button.disabled = true;
        try {
            const session = await window.CampusAPI.signup(details);
            setCurrentUser(session);
            showMessage("Account created. Opening your portal…", "success");
            redirectForRole(session.user.role);
        } catch (error) {
            showMessage(error.message, "error");
            if (button) button.disabled = false;
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        const email = fieldValue("loginEmail").toLowerCase();
        const password = passwordValue("loginPassword");
        const button = event.submitter;
        if (button) button.disabled = true;
        try {
            const rememberMe = Boolean(document.getElementById("rememberMe")?.checked);
            const session = await window.CampusAPI.login({ email, password, rememberMe });
            setCurrentUser(session);
            showMessage("Login successful. Opening your portal…", "success");
            redirectForRole(session.user.role);
        } catch (error) {
            showMessage(error.message, "error");
            if (button) button.disabled = false;
        }
    }

    async function logout() {
        try {
            await window.CampusAPI.logout();
        } catch (error) {
            console.error("Could not revoke the current session:", error);
        } finally {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(CURRENT_USER_KEY);
            window.location.href = window.location.pathname.toLowerCase().includes("/pages/")
                ? "login.html"
                : "Pages/login.html";
        }
    }

    function configureSignupFields() {
        const roleInput = document.getElementById("accountRole");
        const collegeFields = [
            document.getElementById("collegeName")?.closest(".form-group"),
            document.getElementById("collegeId")?.closest(".form-group")
        ].filter(Boolean);
        const adminKeyField = document.getElementById("adminSignupKey")?.closest(".form-group");
        if (!roleInput) return;

        const update = function () {
            const isAdmin = roleInput.value === "admin";
            collegeFields.forEach(function (group) {
                group.hidden = isAdmin;
                const field = group.querySelector("input");
                if (field) field.required = !isAdmin;
            });
            if (adminKeyField) adminKeyField.hidden = !isAdmin;
            const key = document.getElementById("adminSignupKey");
            if (key) key.required = false;
        };
        roleInput.addEventListener("change", update);
        update();
    }

    function installNavigation(user) {
        let container = document.querySelector(".nav-buttons");
        if (!container) {
            container = document.createElement("div");
            container.className = "nav-buttons";
            const header = document.querySelector("header");
            if (header) header.appendChild(container);
        }
        if (!container) return;
        const portal = document.createElement("a");
        portal.href = portalUrl(user.role);
        portal.className = "btn btn-outline";
        portal.textContent = "My Portal";
        const logoutButton = document.createElement("button");
        logoutButton.type = "button";
        logoutButton.className = "btn btn-primary";
        logoutButton.textContent = "Log out";
        logoutButton.addEventListener("click", logout);
        container.replaceChildren(portal, logoutButton);
    }

    function guardPortal() {
        const requiredRoles = {
            "dashboard.html": ["student"],
            "organizer-dashboard.html": ["organizer"],
            "admin-dashboard.html": ["admin"],
            "feedback.html": ["student", "organizer", "admin"]
        };
        const allowedRoles = requiredRoles[currentPage()];
        if (currentPage() === "portal.html") {
            const user = window.CampusAPI.currentUser();
            if (!user || !localStorage.getItem(TOKEN_KEY)) {
                window.location.replace("login.html");
            } else {
                window.CampusAPI.me().then(function (session) {
                    redirectForRole(session.user.role);
                }).catch(function () {
                    localStorage.removeItem(TOKEN_KEY);
                    localStorage.removeItem(CURRENT_USER_KEY);
                    window.location.replace("login.html");
                });
            }
            return;
        }
        if (!allowedRoles) return;
        let user = null;
        try {
            user = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "null");
        } catch (error) {
            user = null;
        }
        if (!localStorage.getItem(TOKEN_KEY) || !user) {
            window.location.replace("login.html");
            return;
        }
        if (!allowedRoles.includes(user.role)) {
            window.location.replace(portalUrl(user.role));
            return;
        }
        document.documentElement.dataset.portalRole = user.role;
        window.CampusAPI.me().then(function (session) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session.user));
            if (!allowedRoles.includes(session.user.role)) {
                window.location.replace(portalUrl(session.user.role));
            }
        }).catch(function () {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(CURRENT_USER_KEY);
            window.location.replace("login.html");
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        const signupForm = document.getElementById("signupForm");
        const loginForm = document.getElementById("loginForm");
        const forgotPasswordButton = document.getElementById("forgotPassword");
        const user = window.CampusAPI.currentUser();
        if (signupForm) signupForm.addEventListener("submit", handleSignup);
        if (loginForm) loginForm.addEventListener("submit", handleLogin);
        if (forgotPasswordButton) {
            forgotPasswordButton.addEventListener("click", function () {
                showMessage(
                    "Self-service password reset is not set up. Contact your campus administrator for help.",
                    "error"
                );
            });
        }
        configureSignupFields();
        if (user) installNavigation(user);
        guardPortal();
    });
})();
