document.addEventListener("DOMContentLoaded", function () {
    const launcher = document.getElementById("eventAssistantLauncher");
    const panel = document.getElementById("eventAssistantPanel");
    const closeButton = document.getElementById("eventAssistantClose");
    const languageSelect = document.getElementById("eventAssistantLanguage");
    const messages = document.getElementById("eventAssistantMessages");
    const form = document.getElementById("eventAssistantForm");
    const input = document.getElementById("eventAssistantInput");
    const languageStorageKey = "eventoraAssistantLanguage";
    let events = [];
    let loadError = false;
    let eventsReady = false;

    if (!launcher || !panel || !languageSelect || !messages || !form || !input) return;

    const translations = {
        en: {
            title: "Campus Event Assistant",
            subtitle: "Ask about event time, date, or venue",
            language: "Reply language",
            launcher: "Ask Event Assistant",
            placeholder: "Try: events at 5 PM or in the auditorium",
            ask: "Ask",
            privacy: "Answers use published event listings. Your question stays in this browser.",
            welcome: "Hi! Ask me about event names, dates, times, or venues. For example: “What events are at 5 PM?”",
            loadingError: "I couldn't load the event list right now. Please try again in a moment.",
            loading: "I'm still loading the event list. Please try again in a moment.",
            emptyQuestion: "Type an event question first. You can ask by time, date, venue, or event name.",
            noFilter: "I couldn't find an event detail in that question. Try a time (like 5 PM), date, venue, or event name.",
            noResults: "I couldn't find any published events matching that. Try another time, date, venue, or name.",
            results: count => `I found ${count} matching ${count === 1 ? "event" : "events"}:`,
            date: "Date",
            time: "Time",
            venue: "Venue",
            category: "Category",
            spots: "Spots left",
            unavailable: "Not available"
        },
        hi: {
            title: "कैंपस इवेंट सहायक",
            subtitle: "इवेंट का समय, तारीख़ या जगह पूछें",
            language: "जवाब की भाषा",
            launcher: "इवेंट सहायक से पूछें",
            placeholder: "जैसे: शाम 5 बजे के इवेंट या ऑडिटोरियम में क्या है?",
            ask: "पूछें",
            privacy: "जवाब प्रकाशित इवेंट सूची से हैं। आपका सवाल इसी ब्राउज़र में रहता है।",
            welcome: "नमस्ते! इवेंट के नाम, तारीख़, समय या जगह के बारे में पूछें। जैसे: “शाम 5 बजे कौन से इवेंट हैं?”",
            loadingError: "अभी इवेंट सूची लोड नहीं हो सकी। कृपया थोड़ी देर बाद फिर कोशिश करें।",
            loading: "इवेंट सूची अभी लोड हो रही है। कृपया थोड़ी देर बाद फिर पूछें।",
            emptyQuestion: "पहले अपना सवाल लिखें। समय, तारीख़, जगह या इवेंट के नाम से पूछ सकते हैं।",
            noFilter: "सवाल में इवेंट की जानकारी नहीं मिली। समय (जैसे शाम 5 बजे), तारीख़, जगह या नाम लिखकर पूछें।",
            noResults: "इस जानकारी से मेल खाते प्रकाशित इवेंट नहीं मिले। कोई दूसरा समय, तारीख़, जगह या नाम आज़माएँ।",
            results: count => `${count} मेल खाते ${count === 1 ? "इवेंट" : "इवेंट"} मिले:`,
            date: "तारीख़",
            time: "समय",
            venue: "जगह",
            category: "श्रेणी",
            spots: "खाली सीटें",
            unavailable: "जानकारी उपलब्ध नहीं"
        },
        hinglish: {
            title: "Campus Event Assistant",
            subtitle: "Event ka time, date ya venue poochho",
            language: "Reply language",
            launcher: "Event Assistant se poochho",
            placeholder: "Jaise: 5 PM par ya auditorium mein kaunse events hain?",
            ask: "Poochho",
            privacy: "Jawab published event list se hain. Aapka sawaal isi browser mein rehta hai.",
            welcome: "Hi! Event name, date, time ya venue ke baare mein poochho. Jaise: “5 PM par kaunse events hain?”",
            loadingError: "Abhi event list load nahi ho paayi. Thodi der baad phir try karo.",
            loading: "Event list abhi load ho rahi hai. Thodi der baad phir poochho.",
            emptyQuestion: "Pehle apna sawaal likho. Time, date, venue ya event name se poochh sakte ho.",
            noFilter: "Sawaal mein event detail nahi mili. Time (jaise 5 PM), date, venue ya event name likho.",
            noResults: "Is detail se match karta published event nahi mila. Koi aur time, date, venue ya naam try karo.",
            results: count => `${count} matching ${count === 1 ? "event" : "events"} mile:`,
            date: "Date",
            time: "Time",
            venue: "Venue",
            category: "Category",
            spots: "Seats baaki",
            unavailable: "Info available nahi"
        }
    };

    const stopWords = new Set([
        "a", "an", "the", "what", "which", "who", "where", "when", "show",
        "find", "tell", "me", "about", "any", "some", "is", "are", "be",
        "will", "happening", "happen", "happens", "event", "events", "at",
        "in", "on", "near", "by", "from", "to", "for", "of", "with", "and",
        "today", "tomorrow", "after", "before", "around", "between", "pm",
        "am", "baje", "samay", "waqt", "time", "date", "venue", "location",
        "place", "please", "upcoming", "ka", "ki", "ke", "ko", "mein", "me",
        "par", "pe", "hai", "hain", "kya", "kaun", "kaunse", "kaunsi",
        "batao", "dikhao", "mujhe", "aaj", "kal", "kahan", "kahaan", "wala",
        "wale", "wali", "kab", "hoga", "hone", "karyakram", "कार्यक्रम", "इवेंट", "इवेंट्स", "कौन", "कौनसे",
        "कौनसी", "क्या", "है", "हैं", "में", "पर", "आज", "कल", "बताओ",
        "दिखाओ", "कहाँ", "कहां", "समय", "जगह", "स्थान", "तारीख", "को", "बजे"
    ]);

    function currentLanguage() {
        return translations[languageSelect.value] ? languageSelect.value : "en";
    }

    function text(key) {
        return translations[currentLanguage()][key];
    }

    function applyLanguage() {
        const language = translations[currentLanguage()];
        document.getElementById("eventAssistantTitle").textContent = language.title;
        document.getElementById("eventAssistantSubtitle").textContent = language.subtitle;
        document.getElementById("eventAssistantLanguageLabel").textContent = language.language;
        document.getElementById("eventAssistantLauncherLabel").textContent = language.launcher;
        document.getElementById("eventAssistantSend").textContent = language.ask;
        document.getElementById("eventAssistantPrivacy").textContent = language.privacy;
        input.placeholder = language.placeholder;
    }

    function addMessage(content, sender) {
        const message = document.createElement("div");
        message.className = "event-assistant-message " + sender;
        message.textContent = content;
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
        return message;
    }

    function normalize(value) {
        return String(value || "")
            .toLocaleLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\p{L}\p{M}\p{N}:/-]+/gu, " ")
            .trim();
    }

    function localDateKey(date) {
        return date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0");
    }

    function parseDate(query) {
        const normalized = normalize(query);
        const iso = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
        if (iso) {
            return { key: `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`, raw: iso[0] };
        }

        const numeric = normalized.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
        if (numeric) {
            return {
                key: `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`,
                raw: numeric[0]
            };
        }

        const todayMatch = normalized.match(/\b(today|aaj)\b/);
        if (todayMatch || normalized.includes("आज")) {
            return { key: localDateKey(new Date()), raw: todayMatch ? todayMatch[0] : "आज" };
        }
        const tomorrowMatch = normalized.match(/\b(tomorrow|kal)\b/);
        if (tomorrowMatch || normalized.includes("कल")) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return { key: localDateKey(tomorrow), raw: tomorrowMatch ? tomorrowMatch[0] : "कल" };
        }
        return null;
    }

    function parseTime(query) {
        const normalized = normalize(query);
        let match = normalized.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
        let hourOnly = false;
        let suffix = "";
        let minute = 0;
        if (match) {
            minute = Number(match[2]);
            suffix = match[3] || "";
        } else {
            match = normalized.match(/\b(\d{1,2})\s*(am|pm)\b/);
            if (match) {
                suffix = match[2];
                hourOnly = true;
            }
        }
        if (!match) {
            match = normalized.match(/(\d{1,2})\s*(baje|बजे)/);
            hourOnly = Boolean(match);
        }
        if (!match) {
            match = normalized.match(/\b(?:at|around|after|before)\s+(\d{1,2})\b/);
            hourOnly = Boolean(match);
        }
        if (!match) return null;
        let hour = Number(match[1]);
        suffix = suffix.toLowerCase();
        if (hour > 23 || minute > 59 || (suffix && (hour < 1 || hour > 12))) return null;

        if (suffix === "pm" && hour < 12) hour += 12;
        if (suffix === "am" && hour === 12) hour = 0;

        const beforeText = normalized.slice(Math.max(0, match.index - 12), match.index);
        const mode = /\bafter\s*$/.test(beforeText)
            ? "after"
            : /\bbefore\s*$/.test(beforeText) ? "before" : "at";

        return {
            hour,
            minute,
            hourOnly: hourOnly || !match[2],
            ambiguous: !suffix && hour < 12,
            mode,
            raw: match[0]
        };
    }

    function eventTimeMinutes(event) {
        const match = String(event.time || "").match(/(\d{1,2}):(\d{2})/);
        if (!match) return null;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
    }

    function matchesTime(event, filter) {
        const value = eventTimeMinutes(event);
        if (value === null) return false;
        const requested = filter.hour * 60 + filter.minute;

        if (filter.mode === "after") return value > requested;
        if (filter.mode === "before") return value < requested;

        if (filter.hourOnly) {
            if (filter.ambiguous) {
                return Math.floor(value / 60) === filter.hour ||
                    Math.floor(value / 60) === filter.hour + 12;
            }
            return Math.floor(value / 60) === filter.hour;
        }
        return value === requested;
    }

    function eventSearchText(event) {
        return normalize([
            event.title,
            event.category,
            event.venue,
            event.description,
            event.organizer
        ].join(" "));
    }

    function findEvents(query) {
        const timeFilter = parseTime(query);
        const dateFilter = parseDate(query);
        let remaining = query;
        if (timeFilter) {
            const escapedTime = timeFilter.raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            remaining = remaining.replace(new RegExp(escapedTime, "i"), " ");
        }
        if (dateFilter) {
            const escapedDate = dateFilter.raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            remaining = remaining.replace(new RegExp(escapedDate, "i"), " ");
        }

        const terms = normalize(remaining)
            .match(/[\p{L}\p{N}]+/gu) || [];
        const keywords = terms.filter(term => !stopWords.has(term));
        if (!timeFilter && !dateFilter && !keywords.length) return null;

        return events.filter(event => {
            if (timeFilter && !matchesTime(event, timeFilter)) return false;
            if (dateFilter && String(event.date || "").slice(0, 10) !== dateFilter.key) return false;
            const searchable = eventSearchText(event);
            return keywords.every(term => searchable.includes(term));
        });
    }

    function formatDate(value) {
        if (!value) return text("unavailable");
        const date = new Date(String(value).slice(0, 10) + "T00:00:00");
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat(currentLanguage() === "hi" ? "hi-IN" : "en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function formatTime(value) {
        if (!value) return text("unavailable");
        const match = String(value).match(/^(\d{1,2}):(\d{2})/);
        if (!match) return String(value);
        const date = new Date();
        date.setHours(Number(match[1]), Number(match[2]), 0, 0);
        return new Intl.DateTimeFormat(currentLanguage() === "hi" ? "hi-IN" : "en-IN", {
            hour: "numeric",
            minute: "2-digit"
        }).format(date);
    }

    function addEventResults(matches) {
        const intro = addMessage(text("results")(matches.length), "assistant");
        const results = document.createElement("div");
        results.className = "event-assistant-results";

        matches.slice(0, 8).forEach(event => {
            const card = document.createElement("article");
            card.className = "event-assistant-event";
            const title = document.createElement("strong");
            title.textContent = event.title || text("unavailable");
            card.appendChild(title);

            [
                [text("date"), formatDate(event.date)],
                [text("time"), formatTime(event.time)],
                [text("venue"), event.venue || text("unavailable")],
                [text("category"), event.category || text("unavailable")],
                [text("spots"), event.remainingCapacity ?? text("unavailable")]
            ].forEach(([label, value]) => {
                const detail = document.createElement("span");
                detail.textContent = `${label}: ${value}`;
                card.appendChild(detail);
            });
            results.appendChild(card);
        });

        if (matches.length > 8) {
            const more = document.createElement("span");
            more.className = "event-assistant-message";
            more.textContent = currentLanguage() === "hi"
                ? `और ${matches.length - 8} इवेंट भी मिले।`
                : currentLanguage() === "hinglish"
                    ? `${matches.length - 8} aur events bhi mile.`
                    : `${matches.length - 8} more events matched.`;
            results.appendChild(more);
        }
        intro.after(results);
        messages.scrollTop = messages.scrollHeight;
    }

    function handleQuestion(question) {
        const trimmed = question.trim();
        if (!trimmed) {
            addMessage(text("emptyQuestion"), "assistant");
            return;
        }
        addMessage(trimmed, "user");
        if (loadError) {
            addMessage(text("loadingError"), "assistant");
            return;
        }
        if (!eventsReady) {
            addMessage(text("loading"), "assistant");
            return;
        }
        const matches = findEvents(trimmed);
        if (matches === null) {
            addMessage(text("noFilter"), "assistant");
        } else if (!matches.length) {
            addMessage(text("noResults"), "assistant");
        } else {
            addEventResults(matches);
        }
    }

    try {
        const savedLanguage = localStorage.getItem(languageStorageKey);
        if (savedLanguage && translations[savedLanguage]) languageSelect.value = savedLanguage;
    } catch (error) {
        // The assistant remains usable when browser storage is unavailable.
    }
    applyLanguage();
    addMessage(text("welcome"), "assistant");

    languageSelect.addEventListener("change", function () {
        applyLanguage();
        try {
            localStorage.setItem(languageStorageKey, languageSelect.value);
        } catch (error) {
            // Language selection still works for the current page.
        }
    });

    launcher.addEventListener("click", function () {
        panel.hidden = !panel.hidden;
        launcher.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) input.focus();
    });

    closeButton.addEventListener("click", function () {
        panel.hidden = true;
        launcher.setAttribute("aria-expanded", "false");
        launcher.focus();
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !panel.hidden) {
            panel.hidden = true;
            launcher.setAttribute("aria-expanded", "false");
            launcher.focus();
        }
    });

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        handleQuestion(input.value);
        input.value = "";
        input.focus();
    });

    window.CampusAPI.listEvents().then(function (loadedEvents) {
        events = loadedEvents.filter(event => event && event.status !== "pending");
        eventsReady = true;
    }).catch(function (error) {
        loadError = true;
        console.error("Event assistant could not load published events:", error);
    });
});
