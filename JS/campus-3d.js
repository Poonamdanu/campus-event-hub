document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById("campus3dCanvas");
    const viewport = document.getElementById("campus3dViewport");
    const statusElement = document.getElementById("campus3dStatus");
    const countElement = document.getElementById("campus3dCount");
    const searchInput = document.getElementById("campus3dSearch");
    const categorySelect = document.getElementById("campus3dCategory");
    const eventList = document.getElementById("campus3dEventList");
    const venueTitle = document.getElementById("campus3dVenueTitle");
    const venueDescription = document.getElementById("campus3dVenueDescription");

    let events = [];
    let selectedVenue = "";
    let scene;
    let camera;
    let renderer;
    let terrainMaterial;
    let photoMaterial;
    let cameraTarget = null;
    let cameraRadius = 132;
    let cameraTheta = 0.72;
    let cameraPhi = 1.05;
    let pointerStart = null;
    let pointerMoved = false;
    let animationFrame = 0;
    const markers = new Map();
    const raycaster = window.THREE ? new THREE.Raycaster() : null;
    const pointer = window.THREE ? new THREE.Vector2() : null;
    const venuePositions = new Map();
    const terrainSize = 148;

    function showStatus(message) {
        statusElement.textContent = message;
        statusElement.hidden = false;
    }

    function hideStatus() {
        statusElement.hidden = true;
        statusElement.textContent = "";
    }

    function terrainHeight(x, z) {
        return 2.5 +
            2.5 * Math.sin((x + 24) * 0.035) * Math.cos((z - 8) * 0.043) +
            1.4 * Math.sin(z * 0.075) +
            3.8 * Math.exp(-((x + 48) ** 2 + (z - 42) ** 2) / 1100) +
            2.6 * Math.exp(-((x - 48) ** 2 + (z + 38) ** 2) / 1400);
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function formatDate(date) {
        const parsed = new Date(date + "T00:00:00");
        if (Number.isNaN(parsed.getTime())) return date;
        return parsed.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function filteredEvents() {
        const query = searchInput.value.trim().toLowerCase();
        const category = categorySelect.value.toLowerCase();
        return events.filter(event =>
            (category === "all" || event.category.toLowerCase() === category) &&
            (!query || [
                event.title,
                event.description,
                event.category,
                event.venue,
                event.organizer
            ].some(value => String(value || "").toLowerCase().includes(query)))
        );
    }

    function venueCoordinates(venue) {
        if (venuePositions.has(venue)) return venuePositions.get(venue);
        const name = venue.toLowerCase();
        let position;
        if (name.includes("computer")) {
            position = [-12, 2];
        } else if (name.includes("auditorium")) {
            position = [20, -25];
        } else if (name.includes("innovation") || name.includes("lab")) {
            position = [-30, 17];
        } else if (name.includes("sport") || name.includes("ground") || name.includes("field")) {
            position = [37, 20];
        } else if (name.includes("open air") || name.includes("theatre") || name.includes("music")) {
            position = [3, 37];
        } else if (name.includes("seminar")) {
            position = [-43, 4];
        } else if (name.includes("library")) {
            position = [1, -39];
        } else {
            let hash = 0;
            for (const character of venue) {
                hash = (hash * 31 + character.charCodeAt(0)) | 0;
            }
            const angle = Math.abs(hash % 360) * Math.PI / 180;
            position = [Math.cos(angle) * 43, Math.sin(angle) * 43];
        }
        venuePositions.set(venue, position);
        return position;
    }

    function buildingAnchor(x, z) {
        return new THREE.Vector3(x, terrainHeight(x, z), z);
    }

    function roundedLabelTexture(text, background, fontSize) {
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 512;
        labelCanvas.height = 144;
        const context = labelCanvas.getContext("2d");
        context.fillStyle = background || "rgba(7,20,38,0.9)";
        context.beginPath();
        context.roundRect(8, 8, 496, 128, 28);
        context.fill();
        context.strokeStyle = "rgba(255,255,255,0.34)";
        context.lineWidth = 3;
        context.stroke();
        context.fillStyle = "#f8fafc";
        context.font = "700 " + (fontSize || 34) + "px Inter, Arial, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        let label = text;
        while (context.measureText(label).width > 454 && label.length > 10) {
            label = label.slice(0, -2) + "…";
        }
        context.fillText(label, 256, 72);
        const texture = new THREE.CanvasTexture(labelCanvas);
        texture.minFilter = THREE.LinearFilter;
        return texture;
    }

    function addGround() {
        const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, 88, 88);
        const positions = geometry.attributes.position;
        const colors = [];
        const lowColor = new THREE.Color("#365d42");
        const midColor = new THREE.Color("#678454");
        const highColor = new THREE.Color("#8a9b70");
        for (let index = 0; index < positions.count; index++) {
            const x = positions.getX(index);
            const z = -positions.getY(index);
            const height = terrainHeight(x, z);
            positions.setZ(index, height);
            const mix = THREE.MathUtils.clamp((height - 1) / 8, 0, 1);
            const color = lowColor.clone().lerp(midColor, Math.min(1, mix * 1.8));
            if (mix > 0.5) color.lerp(highColor, (mix - 0.5) * 0.65);
            colors.push(color.r, color.g, color.b);
        }
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.rotateX(-Math.PI / 2);
        geometry.computeVertexNormals();
        terrainMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.94,
            metalness: 0
        });
        const terrain = new THREE.Mesh(geometry, terrainMaterial);
        terrain.receiveShadow = true;
        scene.add(terrain);

        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(82, 91, 13, 64, 1),
            new THREE.MeshStandardMaterial({ color: "#354b3c", roughness: 1 })
        );
        base.position.y = -4;
        base.receiveShadow = true;
        scene.add(base);

        const edgeRocks = new THREE.Mesh(
            new THREE.TorusGeometry(77, 2.5, 6, 96),
            new THREE.MeshStandardMaterial({ color: "#536c55", roughness: 1 })
        );
        edgeRocks.rotation.x = Math.PI / 2;
        edgeRocks.position.y = 2;
        scene.add(edgeRocks);
    }

    function addRoad(points, color, radius) {
        const curvePoints = points.map(([x, z]) =>
            new THREE.Vector3(x, terrainHeight(x, z) + 0.16, z)
        );
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        const road = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 64, radius, 8, false),
            new THREE.MeshStandardMaterial({
                color: color || "#495960",
                roughness: 0.94
            })
        );
        scene.add(road);
        return curve;
    }

    function addRoads() {
        addRoad([[-69, -8], [-42, -4], [-20, -1], [6, 4], [36, 8], [68, 11]], "#3e5055", 2);
        addRoad([[-28, -67], [-26, -42], [-18, -20], [-8, 0], [1, 21], [4, 48], [10, 69]], "#45575b", 1.7);
        addRoad([[-59, 39], [-43, 22], [-30, 8], [-15, -3], [3, -17], [22, -32], [43, -50]], "#506064", 1.3);
        addRoad([[-54, -44], [-35, -35], [-16, -24], [5, -12], [27, -4], [49, 1]], "#526468", 1.1);
    }

    function addTree(x, z, scale) {
        const y = terrainHeight(x, z);
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18 * scale, 0.32 * scale, 1.9 * scale, 5),
            treeTrunkMaterial
        );
        trunk.position.set(x, y + 0.95 * scale, z);
        scene.add(trunk);
        const foliage = new THREE.Mesh(
            new THREE.ConeGeometry(1.05 * scale, 3.8 * scale, 6),
            treeMaterials[Math.abs(Math.round(x * 13 + z * 7)) % treeMaterials.length]
        );
        foliage.position.set(x, y + 3.2 * scale, z);
        scene.add(foliage);
        const upper = new THREE.Mesh(
            new THREE.ConeGeometry(0.76 * scale, 3.2 * scale, 6),
            treeMaterials[Math.abs(Math.round(x * 5 + z * 17)) % treeMaterials.length]
        );
        upper.position.set(x, y + 5.2 * scale, z);
        scene.add(upper);
    }

    const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: "#624833", roughness: 1 });
    const treeMaterials = [
        new THREE.MeshStandardMaterial({ color: "#234c3a", roughness: 1 }),
        new THREE.MeshStandardMaterial({ color: "#326044", roughness: 1 }),
        new THREE.MeshStandardMaterial({ color: "#3d694b", roughness: 1 })
    ];

    function addForest() {
        let seed = 98421;
        function random() {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        }
        for (let index = 0; index < 132; index++) {
            const angle = random() * Math.PI * 2;
            const radius = 53 + random() * 25;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            addTree(x, z, 0.75 + random() * 0.75);
        }
        for (let index = 0; index < 50; index++) {
            const x = -49 + random() * 98;
            const z = -48 + random() * 96;
            if (Math.abs(x) < 33 && Math.abs(z) < 32) continue;
            addTree(x, z, 0.5 + random() * 0.55);
        }
    }

    function addWindowGrid(group, width, height, depth) {
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: "#8fc7d1",
            emissive: "#224555",
            emissiveIntensity: 0.28,
            roughness: 0.35,
            metalness: 0.18
        });
        const rows = Math.max(2, Math.floor(height / 4));
        const columns = Math.max(3, Math.floor(width / 3.4));
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const windowMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1.05, 0.9, 0.16),
                    windowMaterial
                );
                windowMesh.position.set(
                    -width / 2 + (column + 0.5) * width / columns,
                    2.1 + (row + 0.6) * (height - 3) / rows,
                    depth / 2 + 0.1
                );
                group.add(windowMesh);
            }
        }
    }

    function addBuilding(building, campusTexture) {
        const x = building.x;
        const z = building.z;
        const baseY = terrainHeight(x, z);
        const group = new THREE.Group();
        group.position.set(x, baseY, z);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: building.color || "#d6d5c9",
            roughness: 0.86
        });
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(building.width, building.height, building.depth),
            wallMaterial
        );
        wall.position.y = building.height / 2;
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        const footing = new THREE.Mesh(
            new THREE.BoxGeometry(building.width + 1.5, 1.2, building.depth + 1.5),
            new THREE.MeshStandardMaterial({ color: "#7d817a", roughness: 1 })
        );
        footing.position.y = 0.45;
        group.add(footing);

        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(building.width + 0.8, 0.75, building.depth + 0.8),
            new THREE.MeshStandardMaterial({ color: building.roof || "#8c5445", roughness: 0.8 })
        );
        roof.position.y = building.height + 0.35;
        roof.castShadow = true;
        group.add(roof);

        if (building.photo && campusTexture) {
            const photo = new THREE.Mesh(
                new THREE.PlaneGeometry(building.width * 0.96, building.height * 0.88),
                new THREE.MeshBasicMaterial({ map: campusTexture, toneMapped: false })
            );
            photo.position.set(0, building.height * 0.53, building.depth / 2 + 0.11);
            group.add(photo);
        } else {
            addWindowGrid(group, building.width, building.height, building.depth);
        }

        const sign = new THREE.Sprite(new THREE.SpriteMaterial({
            map: roundedLabelTexture(building.name, "rgba(7,20,38,0.78)", 30),
            transparent: true,
            depthTest: false
        }));
        sign.position.set(0, building.height + 3.6, 0);
        sign.scale.set(11, 3.1, 1);
        sign.userData.isBuildingLabel = true;
        group.add(sign);
        scene.add(group);
    }

    function addSportsField() {
        const x = 38;
        const z = 20;
        const y = terrainHeight(x, z) + 0.18;
        const turf = new THREE.Mesh(
            new THREE.BoxGeometry(25, 0.35, 16),
            new THREE.MeshStandardMaterial({ color: "#477851", roughness: 0.9 })
        );
        turf.position.set(x, y, z);
        scene.add(turf);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: "#dce9d3" });
        for (const offset of [-7, 0, 7]) {
            const line = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 14), lineMaterial);
            line.position.set(x + offset, y + 0.19, z);
            scene.add(line);
        }
        const center = new THREE.Mesh(
            new THREE.TorusGeometry(2.4, 0.08, 4, 40),
            lineMaterial
        );
        center.rotation.x = Math.PI / 2;
        center.position.set(x, y + 0.2, z);
        scene.add(center);
    }

    function addCampusModel(texture) {
        addGround();
        addRoads();
        addForest();
        const buildings = [
            { name: "Main Academic Block", x: -27, z: -16, width: 20, depth: 12, height: 18, photo: true, roof: "#8b5145" },
            { name: "Computer Science Block", x: -12, z: 2, width: 14, depth: 10, height: 13, color: "#c5c6b8" },
            { name: "Innovation Lab", x: -30, z: 17, width: 13, depth: 10, height: 11, color: "#d8d1bd", roof: "#657d87" },
            { name: "Main Auditorium", x: 20, z: -25, width: 20, depth: 14, height: 12, color: "#d8d3c8", roof: "#82584a" },
            { name: "Central Library", x: 2, z: -39, width: 15, depth: 10, height: 12, color: "#ddd8c9", roof: "#526b72" },
            { name: "Student Centre", x: 5, z: 4, width: 16, depth: 12, height: 10, color: "#d9d4c8" },
            { name: "Seminar Hall", x: -43, z: 4, width: 12, depth: 9, height: 9, color: "#cdcbbb", roof: "#6b7371" },
            { name: "Campus Cafe", x: 8, z: 37, width: 12, depth: 9, height: 8, color: "#d5c5a6", roof: "#855d44" },
            { name: "Residence Block", x: 47, z: -12, width: 13, depth: 10, height: 15, color: "#c8c8bd", roof: "#755348" }
        ];
        buildings.forEach(building => addBuilding(building, building.photo ? texture : null));
        addSportsField();
    }

    function makeMarker(venue, venueEvents) {
        const [x, z] = venueCoordinates(venue);
        const y = terrainHeight(x, z);
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.userData.venue = venue;

        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.24, 2.2, 10),
            new THREE.MeshStandardMaterial({ color: "#d9f7ff", emissive: "#1d789f", emissiveIntensity: 0.5 })
        );
        stem.position.y = 1.3;
        group.add(stem);

        const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.9, 18, 14),
            new THREE.MeshStandardMaterial({
                color: "#57d9ff",
                emissive: "#1599d1",
                emissiveIntensity: 1.45,
                roughness: 0.25
            })
        );
        beacon.position.y = 2.7;
        group.add(beacon);

        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(1.28, 0.12, 8, 32),
            new THREE.MeshBasicMaterial({ color: "#8be7ff", transparent: true, opacity: 0.92 })
        );
        halo.position.y = 2.7;
        halo.rotation.x = Math.PI / 2;
        group.add(halo);

        const label = new THREE.Sprite(new THREE.SpriteMaterial({
            map: roundedLabelTexture(venue + " · " + venueEvents.length, "rgba(7,20,38,0.92)", 32),
            transparent: true,
            depthTest: false
        }));
        label.position.y = 5.2;
        label.scale.set(12, 3.3, 1);
        group.add(label);

        group.userData.halo = halo;
        group.userData.beacon = beacon;
        group.userData.eventCount = venueEvents.length;
        scene.add(group);
        markers.set(venue, group);
    }

    function renderDetails(venue, venueEvents) {
        venueTitle.textContent = venue || "Choose a glowing pin";
        venueDescription.textContent = venue
            ? venueEvents.length + (venueEvents.length === 1
                ? " approved event at this venue."
                : " approved events at this venue.")
            : "Select any event marker in the 3D view to explore its venue.";
        eventList.replaceChildren();

        if (!venueEvents.length) {
            eventList.appendChild(makeElement("p", "campus-3d-empty",
                venue ? "No events match the current filters at this venue." : "Choose a glowing pin to see events here."));
            return;
        }

        venueEvents.forEach(event => {
            const card = makeElement("article", "campus-3d-event-card");
            const category = makeElement("span", "campus-3d-event-category", event.category);
            const title = makeElement("strong", "", event.title);
            const dateTime = makeElement("span", "", formatDate(event.date) + " · " + event.time);
            const location = makeElement("span", "", event.venue + " · " + event.remainingCapacity + " of " + event.capacity + " spots left");
            const focusButton = makeElement("button", "campus-3d-focus-button", "Focus venue");
            focusButton.type = "button";
            focusButton.addEventListener("click", () => focusVenue(event.venue));
            card.append(category, title, dateTime, location, focusButton);
            eventList.appendChild(card);
        });
    }

    function focusVenue(venue) {
        selectedVenue = venue;
        const coordinates = venueCoordinates(venue);
        cameraTarget = buildingAnchor(coordinates[0], coordinates[1]);
        cameraRadius = 104;
        renderSceneEvents();
        renderDetails(venue, filteredEvents().filter(event => event.venue === venue));
    }

    function renderSceneEvents() {
        if (!scene) {
            const visibleEvents = filteredEvents();
            countElement.textContent = visibleEvents.length +
                (visibleEvents.length === 1 ? " event" : " events");
            venueTitle.textContent = "Approved campus events";
            venueDescription.textContent = "The event feed is available even though this browser cannot render the 3D model.";
            eventList.replaceChildren();
            if (!visibleEvents.length) {
                eventList.appendChild(makeElement("p", "campus-3d-empty", "No events match these filters."));
                return;
            }
            visibleEvents.forEach(event => {
                const card = makeElement("article", "campus-3d-event-card");
                card.append(
                    makeElement("span", "campus-3d-event-category", event.category),
                    makeElement("strong", "", event.title),
                    makeElement("span", "", formatDate(event.date) + " · " + event.time),
                    makeElement("span", "", event.venue)
                );
                eventList.appendChild(card);
            });
            return;
        }
        markers.forEach(marker => {
            scene.remove(marker);
            marker.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            });
        });
        markers.clear();
        const visibleEvents = filteredEvents();
        const venues = Array.from(new Set(visibleEvents.map(event => event.venue)));
        venues.forEach(venue => {
            const venueEvents = visibleEvents.filter(event => event.venue === venue);
            makeMarker(venue, venueEvents);
        });
        countElement.textContent = visibleEvents.length +
            (visibleEvents.length === 1 ? " event · " : " events · ") +
            venues.length + (venues.length === 1 ? " venue" : " venues");

        if (!venues.includes(selectedVenue)) selectedVenue = "";
        if (selectedVenue) {
            renderDetails(selectedVenue, visibleEvents.filter(event => event.venue === selectedVenue));
        } else if (venues.length) {
            selectedVenue = venues[0];
            renderDetails(selectedVenue, visibleEvents.filter(event => event.venue === selectedVenue));
        } else {
            renderDetails("", []);
            venueTitle.textContent = "No matching events";
            venueDescription.textContent = "Try another search or category.";
        }
    }

    function updateCamera() {
        const target = cameraTarget || new THREE.Vector3(0, 4, 0);
        const sinPhi = Math.sin(cameraPhi);
        camera.position.set(
            target.x + cameraRadius * sinPhi * Math.sin(cameraTheta),
            target.y + cameraRadius * Math.cos(cameraPhi),
            target.z + cameraRadius * sinPhi * Math.cos(cameraTheta)
        );
        camera.lookAt(target);
    }

    function resetCamera() {
        cameraTarget = null;
        cameraRadius = 184;
        cameraTheta = 0.72;
        cameraPhi = 0.95;
        updateCamera();
    }

    function selectMarker(clientX, clientY) {
        const bounds = canvas.getBoundingClientRect();
        pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const candidates = Array.from(markers.values());
        const meshes = [];
        candidates.forEach(marker => marker.traverse(object => {
            if (object.isMesh || object.isSprite) meshes.push(object);
        }));
        const hit = raycaster.intersectObjects(meshes, false)[0];
        if (!hit) return;
        let selected = hit.object;
        while (selected && !selected.userData.venue) selected = selected.parent;
        if (selected) focusVenue(selected.userData.venue);
    }

    function createScene() {
        if (!window.THREE) {
            showStatus("The 3D renderer could not be loaded. The GEHU campus reference photo is available below.");
            return false;
        }
        try {
            renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: true,
                alpha: true,
                powerPreference: "high-performance"
            });
        } catch (error) {
            showStatus("3D view is not supported by this browser or device. The campus photo and event list remain available below.");
            return false;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.92;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        scene = new THREE.Scene();
        scene.background = new THREE.Color("#88aebd");
        scene.fog = new THREE.Fog("#88aebd", 210, 390);
        camera = new THREE.PerspectiveCamera(
            40,
            viewport.clientWidth / viewport.clientHeight,
            0.1,
            420
        );
        scene.add(new THREE.HemisphereLight("#e3f5ff", "#455c47", 1.15));
        const sunlight = new THREE.DirectionalLight("#fff1d2", 1.75);
        sunlight.position.set(-52, 94, 64);
        sunlight.castShadow = true;
        sunlight.shadow.mapSize.set(1024, 1024);
        sunlight.shadow.camera.left = -110;
        sunlight.shadow.camera.right = 110;
        sunlight.shadow.camera.top = 110;
        sunlight.shadow.camera.bottom = -110;
        scene.add(sunlight);
        const fill = new THREE.DirectionalLight("#a8d7f0", 0.45);
        fill.position.set(72, 50, -65);
        scene.add(fill);

        const photoTexture = new THREE.TextureLoader().load(
            "../Assets/gehu-bhimtal-campus.jpg",
            () => hideStatus(),
            undefined,
            () => showStatus("The campus reference image could not be loaded; the illustrative 3D campus is still available.")
        );
        photoTexture.encoding = THREE.sRGBEncoding;
        photoMaterial = photoTexture;
        addCampusModel(photoTexture);
        updateCamera();
        hideStatus();

        canvas.addEventListener("pointerdown", event => {
            pointerStart = { x: event.clientX, y: event.clientY };
            pointerMoved = false;
            canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener("pointermove", event => {
            if (!pointerStart) return;
            const deltaX = event.clientX - pointerStart.x;
            const deltaY = event.clientY - pointerStart.y;
            if (Math.abs(deltaX) + Math.abs(deltaY) > 3) pointerMoved = true;
            cameraTheta -= deltaX * 0.006;
            cameraPhi = THREE.MathUtils.clamp(cameraPhi + deltaY * 0.005, 0.3, 1.48);
            pointerStart = { x: event.clientX, y: event.clientY };
            updateCamera();
        });
        canvas.addEventListener("pointerup", event => {
            if (!pointerMoved) selectMarker(event.clientX, event.clientY);
            pointerStart = null;
        });
        canvas.addEventListener("pointercancel", () => {
            pointerStart = null;
        });
        canvas.addEventListener("wheel", event => {
            event.preventDefault();
            cameraRadius = THREE.MathUtils.clamp(
                cameraRadius + event.deltaY * 0.075,
                75,
                200
            );
            updateCamera();
        }, { passive: false });
        canvas.addEventListener("keydown", event => {
            if (event.key === "ArrowLeft") cameraTheta -= 0.12;
            else if (event.key === "ArrowRight") cameraTheta += 0.12;
            else if (event.key === "ArrowUp") cameraPhi = THREE.MathUtils.clamp(cameraPhi - 0.08, 0.3, 1.48);
            else if (event.key === "ArrowDown") cameraPhi = THREE.MathUtils.clamp(cameraPhi + 0.08, 0.3, 1.48);
            else if (event.key === "+" || event.key === "=") cameraRadius = Math.max(75, cameraRadius - 10);
            else if (event.key === "-" || event.key === "_") cameraRadius = Math.min(200, cameraRadius + 10);
            else if (event.key === "Enter" && selectedVenue) focusVenue(selectedVenue);
            else return;
            event.preventDefault();
            updateCamera();
        });

        function resizeScene() {
            if (!renderer) return;
            const width = viewport.clientWidth;
            const height = viewport.clientHeight;
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
        let resizeObserver = null;
        if ("ResizeObserver" in window) {
            resizeObserver = new ResizeObserver(resizeScene);
            resizeObserver.observe(viewport);
        } else {
            window.addEventListener("resize", resizeScene);
        }
        window.addEventListener("beforeunload", () => {
            cancelAnimationFrame(animationFrame);
            if (resizeObserver) resizeObserver.disconnect();
            else window.removeEventListener("resize", resizeScene);
            renderer.dispose();
            if (terrainMaterial) terrainMaterial.dispose();
            if (photoMaterial) photoMaterial.dispose();
        }, { once: true });

        function animate() {
            animationFrame = requestAnimationFrame(animate);
            const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.12;
            markers.forEach(marker => {
                marker.userData.halo.scale.setScalar(
                    marker.userData.venue === selectedVenue ? pulse * 1.15 : pulse
                );
                marker.userData.halo.material.opacity =
                    marker.userData.venue === selectedVenue ? 1 : 0.68;
            });
            renderer.render(scene, camera);
        }
        animate();
        return true;
    }

    document.getElementById("campus3dReset").addEventListener("click", resetCamera);
    searchInput.addEventListener("input", renderSceneEvents);
    categorySelect.addEventListener("change", renderSceneEvents);

    const sceneReady = createScene();
    if (!sceneReady) {
        countElement.textContent = "3D preview unavailable";
    }

    window.CampusAPI.listEvents()
        .then(data => {
            events = data;
            renderSceneEvents();
        })
        .catch(error => {
            countElement.textContent = "Event feed unavailable";
            eventList.replaceChildren(makeElement(
                "p",
                "campus-3d-empty",
                "Could not load approved campus events: " + error.message
            ));
        });
});
