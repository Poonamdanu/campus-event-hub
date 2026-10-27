
const TEAM_STORAGE_KEY = "eventoraTeams";

const teamForm = document.getElementById("teamForm");
const teamList = document.getElementById("teamList");
const teamSearch = document.getElementById("teamSearch");
const roleFilter = document.getElementById("roleFilter");
const noTeams = document.getElementById("noTeams");
const teamFormMessage = document.getElementById("teamFormMessage");

function getTeams() {
    try {
        return JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function saveTeams(teams) {
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(teams));
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
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

function renderTeams() {
    const teams = getTeams();

    const searchText = teamSearch.value.trim().toLowerCase();
    const selectedRole = roleFilter.value;

    const filteredTeams = teams.filter(function (team) {
        const searchableText = [
            team.name,
            team.event,
            team.skills,
            team.role,
            team.description
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(searchText);
        const matchesRole =
            selectedRole === "all" || team.role === selectedRole;

        return matchesSearch && matchesRole;
    });

    teamList.innerHTML = "";

    filteredTeams.forEach(function (team) {
        const card = document.createElement("article");
        card.className = "team-card";

        card.innerHTML = `
            <div class="team-card-top">
                <span class="team-role-badge">
                    ${escapeHTML(team.role)}
                </span>
                <span class="team-open-badge">● Open</span>
            </div>

            <h3>${escapeHTML(team.event)}</h3>

            <p class="team-card-description">
                ${escapeHTML(team.description)}
            </p>

            <div class="team-skills">
                <strong>Skills:</strong>
                ${escapeHTML(team.skills)}
            </div>

            <div class="team-card-footer">
                <div class="team-student-info">
                    <span class="team-avatar">
                        ${escapeHTML(team.name.charAt(0).toUpperCase())}
                    </span>

                    <div>
                        <strong>${escapeHTML(team.name)}</strong>
                        <small>Team creator</small>
                    </div>
                </div>

                <a
                    class="team-contact-btn"
                    href="mailto:${encodeURIComponent(team.email)}?subject=${encodeURIComponent("Team opportunity: " + team.event)}"
                >
                    Contact
                </a>
            </div>
        `;

        teamList.appendChild(card);
    });

    noTeams.hidden = filteredTeams.length !== 0;

    document.getElementById("teamCount").textContent = teams.length;

    document.getElementById("openPositions").textContent = teams.length;

    const uniqueProjects = new Set(
        teams.map(function (team) {
            return team.event.trim().toLowerCase();
        })
    );

    document.getElementById("projectCount").textContent =
        uniqueProjects.size;
}

teamForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("studentName").value.trim();
    const email = document.getElementById("studentEmail").value.trim();
    const eventName = document.getElementById("teamEvent").value.trim();
    const skills = document.getElementById("studentSkills").value.trim();
    const role = document.getElementById("teamRole").value;
    const description = document.getElementById("teamDescription").value.trim();

    if (!name || !email || !eventName || !skills || !role || !description) {
        teamFormMessage.textContent = "Please fill in all fields.";
        teamFormMessage.className = "team-message error";
        return;
    }

    const teams = getTeams();

    const newTeam = {
        id: Date.now(),
        name: name,
        email: email,
        event: eventName,
        skills: skills,
        role: role,
        description: description,
        createdAt: new Date().toISOString()
    };

    teams.unshift(newTeam);
    saveTeams(teams);

    teamForm.reset();

    teamSearch.value = "";
    roleFilter.value = "all";

    teamFormMessage.textContent = "Your team requirement was posted successfully!";
    teamFormMessage.className = "team-message success";

    renderTeams();
});

teamSearch.addEventListener("input", renderTeams);
roleFilter.addEventListener("change", renderTeams);

document.getElementById("currentYear").textContent =
    new Date().getFullYear();

renderTeams();

