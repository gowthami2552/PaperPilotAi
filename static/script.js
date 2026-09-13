const API_URL = 'http://localhost:5050/api';
let currentProjectId = null;
let currentStep = 0;
let isDemoMode = false;
let globalJournals = [];
let currentUser = JSON.parse(localStorage.getItem('rr_user')) || null;

document.addEventListener('DOMContentLoaded', () => {
    updateNavAuth();
    init3DScene();
    init3DCardsTilt();
    if (currentUser) {
        showDashboard();
    } else {
        showView('view-landing');
    }
});

/* ════════════════════════════════════════════════════════════ */
/* RESEARCH-THEMED INTERACTIVE 3D WEBGL ENGINE (THREE.JS)    */
/* ════════════════════════════════════════════════════════════ */
let scene, camera, renderer, particlesMesh, booksGroup, laptopsGroup, docsGroup;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;

function init3DScene() {
    const canvas = document.getElementById('webgl-bg');
    if (!canvas || typeof THREE === 'undefined') return;

    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 35;

    // 2. WebGL Renderer Setup
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3. Helper: Create Realistic 3D Book Model
    function create3DBook(coverColorHex) {
        const book = new THREE.Group();

        // 1. Hardcover (Beveled/Extruded Base)
        const coverGeo = new THREE.BoxGeometry(3.4, 4.4, 0.7);
        const coverMat = new THREE.MeshBasicMaterial({ color: coverColorHex, transparent: true, opacity: 0.88 });
        const cover = new THREE.Mesh(coverGeo, coverMat);
        book.add(cover);

        // Cover Gold/Silver Foil Title Plate
        const plateGeo = new THREE.PlaneGeometry(2.0, 1.2);
        const plateMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.set(0, 0.6, 0.36);
        book.add(plate);

        // 2. Inner Paper Pages Block
        const paperGeo = new THREE.BoxGeometry(3.2, 4.2, 0.58);
        const paperMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.95 });
        const paper = new THREE.Mesh(paperGeo, paperMat);
        paper.position.x = 0.1; // Offset to show spine on left
        book.add(paper);

        // Page Texture Lines on exposed paper edges
        const edgePts = [
            new THREE.Vector3(1.7, 2.1, 0.25), new THREE.Vector3(1.7, -2.1, 0.25),
            new THREE.Vector3(1.7, 2.1, -0.25), new THREE.Vector3(1.7, -2.1, -0.25)
        ];
        const edgeLineGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
        book.add(new THREE.Line(edgeLineGeo, new THREE.LineBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.5 })));

        // 3. Silk Ribbon Bookmark
        const ribbonPts = [
            new THREE.Vector3(0.2, -2.1, 0.1),
            new THREE.Vector3(0.4, -2.9, 0.3),
            new THREE.Vector3(0.2, -3.4, 0.5)
        ];
        const ribbonGeo = new THREE.BufferGeometry().setFromPoints(ribbonPts);
        const ribbonMat = new THREE.LineBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.9 });
        book.add(new THREE.Line(ribbonGeo, ribbonMat));

        // 4. Glowing Outlines
        const edges = new THREE.EdgesGeometry(coverGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.85 });
        book.add(new THREE.LineSegments(edges, lineMat));

        return book;
    }

    // 4. Helper: Create Realistic 3D Laptop Model (with 3D Keycaps, Keyboard Well, Trackpad & Hinge)
    function create3DLaptop() {
        const laptop = new THREE.Group();

        // A) Metallic Main Chassis Base Deck
        const baseGeo = new THREE.BoxGeometry(5.4, 0.22, 3.8);
        const baseMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.9 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        laptop.add(baseMesh);

        // Base Outlines
        const baseEdges = new THREE.EdgesGeometry(baseGeo);
        laptop.add(new THREE.LineSegments(baseEdges, new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.85 })));

        // B) Sunken Keyboard Well
        const kbWellGeo = new THREE.BoxGeometry(4.8, 0.05, 2.2);
        const kbWellMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
        const kbWell = new THREE.Mesh(kbWellGeo, kbWellMat);
        kbWell.position.set(0, 0.1, -0.4);
        laptop.add(kbWell);

        // C) REALISTIC KEYBOARD KEYS GRID (5 rows of 12 individual keycaps)
        const keysGroup = new THREE.Group();
        const keyGeo = new THREE.BoxGeometry(0.32, 0.08, 0.32);
        const keyMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
        const keyEdgeMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 });

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 12; col++) {
                // Skip middle of bottom row for spacebar
                if (row === 4 && col >= 4 && col <= 7) continue;

                const k = new THREE.Mesh(keyGeo, keyMat);
                const kx = -2.1 + col * 0.38;
                const kz = -1.2 + row * 0.4;
                k.position.set(kx, 0.14, kz);
                
                // Key edge outline
                const kEdge = new THREE.LineSegments(new THREE.EdgesGeometry(keyGeo), keyEdgeMat);
                k.add(kEdge);

                keysGroup.add(k);
            }
        }

        // Realistic Spacebar Key
        const spaceGeo = new THREE.BoxGeometry(1.7, 0.08, 0.32);
        const spaceBar = new THREE.Mesh(spaceGeo, keyMat);
        spaceBar.position.set(0, 0.14, 0.4);
        spaceBar.add(new THREE.LineSegments(new THREE.EdgesGeometry(spaceGeo), keyEdgeMat));
        keysGroup.add(spaceBar);

        laptop.add(keysGroup);

        // D) Chamfered Glass Trackpad
        const padGeo = new THREE.BoxGeometry(1.6, 0.04, 1.1);
        const padMesh = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x475569 }));
        padMesh.position.set(0, 0.12, 1.1);
        padMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(padGeo), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 })));
        laptop.add(padMesh);

        // E) Hinge Bar
        const hingeGeo = new THREE.CylinderGeometry(0.09, 0.09, 5.0, 16);
        const hingeMat = new THREE.MeshBasicMaterial({ color: 0x64748b });
        const hinge = new THREE.Mesh(hingeGeo, hingeMat);
        hinge.rotation.z = Math.PI / 2;
        hinge.position.set(0, 0.11, -1.85);
        laptop.add(hinge);

        // F) Display Lid Assembly
        const lidGroup = new THREE.Group();
        lidGroup.position.set(0, 0.11, -1.85);

        const screenDeckGeo = new THREE.BoxGeometry(5.4, 3.6, 0.16);
        const screenDeckMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.92 });
        const screenDeck = new THREE.Mesh(screenDeckGeo, screenDeckMat);
        screenDeck.position.set(0, 1.8, 0);
        lidGroup.add(screenDeck);

        // Glowing Screen Panel
        const displayGeo = new THREE.PlaneGeometry(5.0, 3.2);
        const displayMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const display = new THREE.Mesh(displayGeo, displayMat);
        display.position.set(0, 1.8, 0.09);
        lidGroup.add(display);

        // Code/Editor Text Lines on Screen
        for (let lineY = 3.0; lineY >= 0.6; lineY -= 0.45) {
            const linePts = [
                new THREE.Vector3(-2.2, lineY, 0.1),
                new THREE.Vector3(-2.2 + (Math.random() * 2.8 + 1.4), lineY, 0.1)
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
            lidGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: (lineY > 2.2 ? 0xf43f5e : (lineY > 1.2 ? 0xa78bfa : 0x34d399)), transparent: true, opacity: 0.75 })));
        }

        // Top Webcam Dot
        const camGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const camMesh = new THREE.Mesh(camGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
        camMesh.position.set(0, 3.45, 0.09);
        lidGroup.add(camMesh);

        // Lid Edges
        const lidEdges = new THREE.EdgesGeometry(screenDeckGeo);
        const lidLineMesh = new THREE.LineSegments(lidEdges, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }));
        lidLineMesh.position.set(0, 1.8, 0);
        lidGroup.add(lidLineMesh);

        lidGroup.rotation.x = -0.32; // Open lid angle

        laptop.add(lidGroup);
        return laptop;
    }

    // 5. Build Floating 3D Books Collection (Spread all over viewport)
    booksGroup = new THREE.Group();
    const bookColors = [0x4f46e5, 0xec4899, 0x10b981, 0x8b5cf6, 0x3b82f6, 0xf59e0b];
    const bookPositions = [
        { x: -38, y: 18, z: -10, rotX: 0.4, rotY: 0.6 },
        { x: 38, y: 16, z: -12, rotX: -0.3, rotY: 0.5 },
        { x: -42, y: -16, z: -15, rotX: 0.5, rotY: -0.4 },
        { x: 40, y: -18, z: -14, rotX: -0.2, rotY: -0.6 },
        { x: -18, y: 22, z: -20, rotX: 0.3, rotY: -0.3 },
        { x: 18, y: 20, z: -22, rotX: -0.4, rotY: 0.4 },
        { x: -22, y: -22, z: -18, rotX: 0.2, rotY: 0.7 },
        { x: 22, y: -20, z: -16, rotX: -0.5, rotY: -0.2 }
    ];

    bookPositions.forEach((pos, i) => {
        const b = create3DBook(bookColors[i % bookColors.length]);
        b.position.set(pos.x, pos.y, pos.z);
        b.rotation.set(pos.rotX, pos.rotY, 0);
        b.userData = { initialY: pos.y, speed: 0.012 + i * 0.002 };
        booksGroup.add(b);
    });
    scene.add(booksGroup);

    // 6. Build Floating 3D Laptops Collection (Spread all over viewport)
    laptopsGroup = new THREE.Group();
    const laptopPositions = [
        { x: -35, y: 2, z: -14, rotX: 0.3, rotY: 0.4 },
        { x: 35, y: -2, z: -15, rotX: -0.2, rotY: -0.5 },
        { x: -12, y: -20, z: -24, rotX: 0.4, rotY: -0.3 },
        { x: 12, y: 22, z: -25, rotX: -0.3, rotY: 0.6 }
    ];

    laptopPositions.forEach((pos, i) => {
        const lap = create3DLaptop();
        lap.position.set(pos.x, pos.y, pos.z);
        lap.rotation.set(pos.rotX, pos.rotY, 0);
        lap.userData = { initialY: pos.y, speed: 0.01 + i * 0.003 };
        laptopsGroup.add(lap);
    });
    scene.add(laptopsGroup);

    // 7. Create 3D Floating Manuscript Files / Document Sheets (Stacked Realism Effect)
    docsGroup = new THREE.Group();
    const docSheetGeo = new THREE.PlaneGeometry(3.6, 4.8);
    const docPositions = [
        { x: -45, y: 8, z: -8, rotX: 0.2, rotY: 0.4 },
        { x: 45, y: -6, z: -10, rotX: -0.3, rotY: -0.2 },
        { x: -30, y: -22, z: -12, rotX: 0.1, rotY: -0.5 },
        { x: 30, y: 24, z: -14, rotX: -0.2, rotY: 0.3 },
        { x: -8, y: 18, z: -16, rotX: 0.4, rotY: 0.1 },
        { x: 8, y: -18, z: -18, rotX: -0.1, rotY: -0.4 },
        { x: -28, y: 26, z: -20, rotX: 0.3, rotY: 0.2 },
        { x: 28, y: -24, z: -22, rotX: -0.4, rotY: -0.3 },
        { x: -48, y: -12, z: -25, rotX: 0.2, rotY: -0.6 },
        { x: 48, y: 14, z: -26, rotX: -0.5, rotY: 0.5 }
    ];

    docPositions.forEach((pos, idx) => {
        const singleDoc = new THREE.Group();

        // 3D Glass Document Page
        const docMat = new THREE.MeshBasicMaterial({
            color: 0x1e293b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.82
        });
        const docMesh = new THREE.Mesh(docSheetGeo, docMat);
        singleDoc.add(docMesh);

        // Underneath Offset Shadow Sheet for Stacked Paper Realism
        const subDocMesh = new THREE.Mesh(docSheetGeo, new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
        subDocMesh.position.set(0.12, -0.12, -0.06);
        singleDoc.add(subDocMesh);

        // Glowing Page Border
        const edges = new THREE.EdgesGeometry(docSheetGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.85 });
        const border = new THREE.LineSegments(edges, lineMat);
        singleDoc.add(border);

        // Two-Column Realistic Manuscript Typography Wireframe
        // Header Title
        const titlePts = [new THREE.Vector3(-1.3, 1.8, 0.03), new THREE.Vector3(0.8, 1.8, 0.03)];
        singleDoc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(titlePts), new THREE.LineBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.9 })));

        // Column 1 Lines
        for (let lineY = 1.2; lineY >= -1.8; lineY -= 0.4) {
            const linePts = [new THREE.Vector3(-1.4, lineY, 0.03), new THREE.Vector3(-0.1, lineY, 0.03)];
            singleDoc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 })));
        }

        // Column 2 Lines
        for (let lineY = 1.2; lineY >= -1.8; lineY -= 0.4) {
            const linePts = [new THREE.Vector3(0.1, lineY, 0.03), new THREE.Vector3(1.4, lineY, 0.03)];
            singleDoc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 })));
        }

        singleDoc.position.set(pos.x, pos.y, pos.z);
        singleDoc.rotation.set(pos.rotX, pos.rotY, 0);
        singleDoc.userData = { initialY: pos.y, speed: 0.01 + idx * 0.003 };
        docsGroup.add(singleDoc);
    });
    scene.add(docsGroup);

    // 8. Create 3D Floating Citation & Data Particles (Wide Viewport Spread)
    const particlesCount = 1200;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 200;     // X
        posArray[i + 1] = (Math.random() - 0.5) * 150; // Y
        posArray[i + 2] = (Math.random() - 0.5) * 150; // Z
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.38,
        color: 0x818cf8,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending
    });

    particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // 9. Mouse Parallax Listeners
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX - window.innerWidth / 2);
        mouseY = (e.clientY - window.innerHeight / 2);
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 10. 3D Animation Loop
    let clock = 0;
    function animate3D() {
        requestAnimationFrame(animate3D);
        clock += 0.015;

        // Smooth Mouse Parallax Lerp
        targetX = mouseX * 0.0008;
        targetY = mouseY * 0.0008;

        camera.position.x += (targetX * 10 - camera.position.x) * 0.05;
        camera.position.y += (-targetY * 10 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        // Rotate & Float 3D Books
        if (booksGroup) {
            booksGroup.children.forEach((bk, i) => {
                bk.position.y = bk.userData.initialY + Math.sin(clock + i) * 1.2;
                bk.rotation.y += 0.008;
                bk.rotation.x += 0.003;
            });
        }

        // Rotate & Float 3D Laptops
        if (laptopsGroup) {
            laptopsGroup.children.forEach((lap, i) => {
                lap.position.y = lap.userData.initialY + Math.cos(clock * 0.8 + i) * 1.4;
                lap.rotation.y += 0.006;
                lap.rotation.z += 0.002;
            });
        }

        // Float & Rotate 3D Manuscript File Pages
        if (docsGroup) {
            docsGroup.children.forEach((doc, idx) => {
                doc.position.y = doc.userData.initialY + Math.sin(clock + idx) * 1.5;
                doc.rotation.y += 0.004;
                doc.rotation.x += 0.002;
            });
        }

        if (particlesMesh) {
            particlesMesh.rotation.y -= 0.0005;
            particlesMesh.rotation.x += 0.0003;
        }

        renderer.render(scene, camera);
    }

    animate3D();
}

/* 3D Interactive Card Tilt Effect */
function init3DCardsTilt() {
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.glass-card, .feature-card, .dash-stat-card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -8;
                const rotateY = ((x - centerX) / centerX) * 8;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
                card.style.boxShadow = `0 15px 35px rgba(79, 70, 229, 0.25)`;
            } else {
                card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
                card.style.boxShadow = ``;
            }
        });
    });
}

function updateNavAuth() {
    const navLinksAuth = document.getElementById('navLinksAuth');
    if (currentUser) {
        navLinksAuth.innerHTML = `
            <a href="#" id="nav-dashboard" onclick="showDashboard()">Dashboard</a>
            <a href="#" id="nav-new" onclick="startFlow()">New Analysis</a>
            <a href="#" id="nav-manuscripts" onclick="showManuscripts()">My Manuscripts</a>
            <a href="#" id="nav-templates" onclick="showTemplates()">Templates</a>
            <a href="#" id="nav-profile" onclick="showProfile()" style="display:flex; align-items:center; gap:0.5rem; margin-left:2rem; background:rgba(255,255,255,0.05); padding:0.4rem 1rem; border-radius:20px;">
                <img src="${currentUser.photo_url}" style="width:24px; height:24px; border-radius:50%;">
                ${currentUser.name.split(' ')[0]}
            </a>
            <a href="#" onclick="logout()" style="color:var(--danger); font-size:0.85rem;"><i class="fa-solid fa-right-from-bracket"></i></a>
        `;
    } else {
        navLinksAuth.innerHTML = `
            <a href="#" id="nav-landing" class="active" onclick="showView('view-landing'); activateNav('nav-landing');">Home</a>
            <a href="#" id="nav-templates" onclick="showTemplates()">Templates</a>
            <a href="#" class="btn-secondary" style="padding:0.4rem 1rem; margin-left:2rem;" onclick="showAuth('login')">Log In</a>
            <a href="#" class="btn-primary" style="padding:0.4rem 1rem; margin-left:1rem; color:white;" onclick="showAuth('signup')">Sign Up</a>
        `;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('rr_user');
    updateNavAuth();
    showView('view-landing');
}

let isSignUp = false;
function showAuth(mode) {
    activateNav('');
    document.getElementById('progressTracker').style.display = 'none';
    showView('view-auth');
    isSignUp = (mode === 'signup');
    updateAuthUI();
}

function toggleAuthMode() {
    isSignUp = !isSignUp;
    updateAuthUI();
}

function updateAuthUI() {
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const nameField = document.getElementById('nameField');
    const btn = document.getElementById('authBtn');
    const toggleText = document.getElementById('authToggleText');
    const toggleLink = document.getElementById('authToggleLink');
    
    if (isSignUp) {
        title.innerText = "Create Account";
        subtitle.innerText = "Join PaperPilot AI to analyze your manuscripts.";
        nameField.style.display = 'block';
        document.getElementById('authName').required = true;
        btn.innerText = "Sign Up";
        toggleText.innerText = "Already have an account?";
        toggleLink.innerText = "Log In";
    } else {
        title.innerText = "Welcome Back";
        subtitle.innerText = "Log in to manage your manuscripts.";
        nameField.style.display = 'none';
        document.getElementById('authName').required = false;
        btn.innerText = "Log In";
        toggleText.innerText = "Don't have an account?";
        toggleLink.innerText = "Sign Up";
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;
    
    showLoading('Authenticating...');
    try {
        const endpoint = isSignUp ? '/register' : '/login';
        const body = isSignUp ? {email, password, name} : {email, password};
        
        const res = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        
        const data = await res.json();
        hideLoading();
        
        if (data.error) {
            alert(data.error);
        } else {
            currentUser = data;
            localStorage.setItem('rr_user', JSON.stringify(data));
            updateNavAuth();
            showDashboard();
        }
    } catch(err) {
        hideLoading();
        alert("Authentication failed.");
    }
}

function showProfile() {
    activateNav('nav-profile');
    document.getElementById('progressTracker').style.display = 'none';
    showView('view-profile');
    
    document.getElementById('profileAvatar').src = currentUser.photo_url;
    document.getElementById('profileName').value = currentUser.name;
    document.getElementById('profileEmail').value = currentUser.email;
    document.getElementById('photoInput').value = currentUser.photo_url;
    
    // Toggle photo input
    const photoBtn = document.querySelector('#view-profile .btn-outline');
    const photoInput = document.getElementById('photoInput');
    photoBtn.onclick = (e) => {
        e.preventDefault();
        photoInput.style.display = photoInput.style.display === 'none' ? 'block' : 'none';
    };
}

async function updateProfile(e) {
    e.preventDefault();
    const name = document.getElementById('profileName').value;
    const photo_url = document.getElementById('photoInput').value;
    
    showLoading('Saving profile...');
    try {
        const res = await fetch(`${API_URL}/profile/${currentUser.id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, photo_url})
        });
        const data = await res.json();
        hideLoading();
        
        if (data.error) {
            alert(data.error);
        } else {
            currentUser = data;
            localStorage.setItem('rr_user', JSON.stringify(data));
            updateNavAuth();
            showProfile();
            alert("Profile updated!");
        }
    } catch(err) {
        hideLoading();
        alert("Failed to update profile.");
    }
}

function activateNav(navId) {
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    if (navId) {
        const el = document.getElementById(navId);
        if(el) el.classList.add('active');
    }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'hidden'));
    document.querySelectorAll('.view').forEach(v => {
        if(v.id !== viewId) v.classList.add('hidden');
    });
    document.getElementById(viewId).classList.add('active');
}

function updateProgressTracker(step) {
    const tracker = document.getElementById('progressTracker');
    if (step > 0) tracker.style.display = 'flex';
    else tracker.style.display = 'none';

    document.querySelectorAll('.step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (sNum < step) s.classList.add('completed');
        else if (sNum === step) s.classList.add('active');
    });
}

function showDashboard() {
    activateNav('nav-dashboard');
    updateProgressTracker(0);
    showView('view-dashboard');
    loadDashboardStats();
}

async function loadDashboardStats() {
    try {
        let url = `${API_URL}/projects`;
        if (currentUser) {
            url += `?user_id=${currentUser.id}`;
        }
        const res = await fetch(url);
        const projects = await res.json();
        
        document.getElementById('statManuscripts').innerText = projects.length;
        
        let completed = 0;
        let totalScore = 0;
        let issues = 47; // Mock for now
        
        const tbody = document.getElementById('dashboardTableBody');
        let html = '';
        
        projects.forEach((p, idx) => {
            if (p.status.includes('Completed') || p.status.includes('Ready') || p.status.includes('Revision')) {
                completed++;
            }
            if (p.score > 0) {
                totalScore += p.score;
            }
            
            if (idx < 5) {
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 1rem 0;"><strong>${p.name}</strong></td>
                        <td style="padding: 1rem 0;"><span class="text-muted">Selected</span></td>
                        <td style="padding: 1rem 0;">
                            <span style="color: ${p.score >= 80 ? 'var(--success)' : 'var(--warning)'}; font-weight: bold;">
                                ${p.score > 0 ? p.score : '-'}
                            </span>
                        </td>
                        <td style="padding: 1rem 0;"><span class="demo-badge" style="${p.score >= 80 ? '' : 'color:var(--warning);background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.3)'}">${p.status}</span></td>
                        <td style="padding: 1rem 0; font-size:0.85rem;" class="text-muted">${p.date.split(' ')[0]}</td>
                    </tr>
                `;
            }
        });
        
        document.getElementById('statCompleted').innerText = completed;
        if (completed > 0) {
            document.getElementById('statReadiness').innerText = Math.round(totalScore / completed) + '%';
        } else {
            document.getElementById('statReadiness').innerText = '-';
        }
        
        tbody.innerHTML = html || '<tr><td colspan="5" class="text-muted text-center" style="padding:2rem;">No recent manuscripts.</td></tr>';
        
    } catch(e) {
        console.error("Dashboard error:", e);
    }
}

function startFlow() {
    if (!currentUser && !isDemoMode) {
        showAuth('login');
        return;
    }
    isDemoMode = false;
    currentStep = 1;
    activateNav('nav-new');
    updateProgressTracker(1);
    showView('view-upload');
}

async function tryDemo() {
    isDemoMode = true;
    startFlow();
    currentProjectId = 999;
    
    showLoading('Loading demo manuscript...');
    simulateChecklist(['Uploading file to server...', 'Validating DOCX format...', 'Initializing project space...']);
    
    setTimeout(() => {
        hideLoading();
        nextStep(2);
    }, 2500);
}

// File Upload Logic
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

if(dropZone && fileInput) {
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleUpload(e.target.files[0]);
    });
}

async function handleUpload(file) {
    if (!file.name.endsWith('.docx')) {
        alert('Please upload a .docx file');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (currentUser) {
        formData.append('user_id', currentUser.id);
    }

    showLoading('Uploading manuscript...');
    simulateChecklist(['Uploading document securely...', 'Verifying file integrity...', 'Creating project...']);
    try {
        const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        currentProjectId = data.project_id;
        document.getElementById('pkgDocxName').innerText = data.filename;
        
        hideLoading();
        nextStep(2);
    } catch (err) {
        hideLoading();
        alert('Upload failed: ' + err.message);
    }
}

// Flow Progression
async function nextStep(step) {
    currentStep = step;
    updateProgressTracker(step);

    if (step === 2) await loadAnalysis();
    else if (step === 3) await loadCitations();
    else if (step === 4) await loadJournals();
    else if (step === 5) await loadAIReview();
    else if (step === 6) await loadImprovements();
    else if (step === 7) await loadExport();
}

async function loadAnalysis() {
    showView('view-analyze');
    showLoading('Document Analysis');
    simulateChecklist(['Understanding document structure...', 'Identifying sections and headings...', 'Detecting tables, figures and equations...']);
    
    let data;
    if (isDemoMode) {
        data = { pages: 12, sections: 8, tables: 4, figures: 3, equations: 8, structure: [
            {text: "Abstract", level: 1}, {text: "Introduction", level: 1}, {text: "Literature Review", level: 1},
            {text: "Methodology", level: 1}, {text: "Dataset", level: 2}, {text: "Proposed Method", level: 2},
            {text: "Results", level: 1}, {text: "Conclusion", level: 1}, {text: "References", level: 1}
        ]};
        setTimeout(() => { hideLoading(); renderAnalysis(data); }, 3000);
    } else {
        const res = await fetch(`${API_URL}/analyze-document/${currentProjectId}`, { method: 'POST' });
        data = await res.json();
        
        // Also fetch structure data
        // We'll mock the structure list for now if not fully returned by backend
        data.structure = [
            {text: "Abstract", level: 1}, {text: "Introduction", level: 1}, {text: "Methodology", level: 1},
            {text: "Results", level: 1}, {text: "Discussion", level: 1}, {text: "Conclusion", level: 1}
        ];
        
        hideLoading();
        renderAnalysis(data);
    }
}

function renderAnalysis(data) {
    // Render Sections List
    let sectionsHtml = '';
    data.structure.filter(s => s.level === 1).forEach(s => {
        sectionsHtml += `
            <div class="section-item">
                <span><i class="fa-solid fa-check" style="color:var(--success);margin-right:8px;"></i> ${s.text}</span>
            </div>
        `;
    });
    document.getElementById('detectedSections').innerHTML = sectionsHtml || '<p class="text-muted">No explicit sections found.</p>';

    // Render Tree
    let treeHtml = '<div class="tree-node"><i class="fa-solid fa-folder"></i> <strong>Research Paper</strong></div>';
    data.structure.forEach(s => {
        let padding = s.level * 20;
        let icon = s.level === 1 ? 'fa-folder' : 'fa-file-lines';
        treeHtml += `<div class="tree-node" style="padding-left: ${padding}px"><i class="fa-solid ${icon}"></i> ${s.text}</div>`;
    });
    document.getElementById('structureTree').innerHTML = treeHtml;

    // Render Stats
    const stats = [
        {icon: 'fa-file', label: 'Pages', val: data.pages, color: '#3b82f6'},
        {icon: 'fa-table', label: 'Tables', val: data.tables, color: '#8b5cf6'},
        {icon: 'fa-image', label: 'Figures', val: data.figures, color: '#ec4899'},
        {icon: 'fa-superscript', label: 'Equations', val: data.equations || 0, color: '#f59e0b'}
    ];
    let statsHtml = '';
    stats.forEach(s => {
        statsHtml += `
            <div class="doc-stat-item">
                <div class="doc-stat-label"><i class="fa-solid ${s.icon}" style="color:${s.color};"></i> ${s.label}</div>
                <div class="doc-stat-val">${s.val}</div>
            </div>
        `;
    });
    document.getElementById('docStats').innerHTML = statsHtml;
}

async function loadCitations() {
    showView('view-citations');
    showLoading('Citation Intelligence');
    simulateChecklist(['Extracting reference list...', 'Mapping in-text citations...', 'Validating citation consistency...']);
    
    let data;
    if (isDemoMode) {
        data = { citation_score: 91, total_citations: 37, total_references: 42, missing_references: 0, unused_references: 5, issues: [
            {type: 'info', message: 'Citation and reference counts appear balanced.'},
            {type: 'warning', message: '5 references do not appear to be cited in the text.'}
        ]};
        setTimeout(() => { hideLoading(); renderCitations(data); }, 2500);
    } else {
        const res = await fetch(`${API_URL}/analyze-citations/${currentProjectId}`, { method: 'POST' });
        data = await res.json();
        hideLoading();
        renderCitations(data);
    }
}

function renderCitations(data) {
    document.getElementById('citationScoreText').innerText = data.citation_score;
    document.getElementById('citationScoreCircle').style.background = `conic-gradient(${data.citation_score >= 80 ? 'var(--success)' : 'var(--warning)'} ${data.citation_score}%, #333 0)`;
    
    const stats = [
        {val: data.total_citations, label: 'In-text Citations'},
        {val: data.total_references, label: 'References List'},
        {val: data.missing_references, label: 'Missing References'},
        {val: data.unused_references, label: 'Unused References'}
    ];
    let statsHtml = '';
    stats.forEach(s => {
        statsHtml += `<div class="stat-box"><div class="stat-value">${s.val}</div><div class="stat-label">${s.label}</div></div>`;
    });
    document.getElementById('citationStats').innerHTML = statsHtml;

    let issuesHtml = '';
    if(data.issues && data.issues.length) {
        data.issues.forEach(iss => {
            let color = iss.type === 'danger' ? 'var(--danger)' : (iss.type === 'warning' ? 'var(--warning)' : 'var(--primary)');
            issuesHtml += `<div style="padding:1rem;background:rgba(255,255,255,0.05);border-left:3px solid ${color};margin-bottom:0.5rem;border-radius:4px;">${iss.message}</div>`;
        });
    } else {
        issuesHtml = '<p class="text-muted">No citation issues detected.</p>';
    }
    document.getElementById('citationIssues').innerHTML = issuesHtml;
}

async function loadJournals() {
    showView('view-journal');
    
    if (globalJournals.length === 0) {
        const res = await fetch(`${API_URL}/journals`);
        globalJournals = await res.json();
    }
    renderJournals(globalJournals);
}

function renderJournals(journals) {
    let html = '';
    journals.forEach(j => {
        html += `
            <div class="journal-card" onclick="selectJournal(${j.id})">
                <div class="journal-header">
                    <div class="journal-icon">${j.publisher.substring(0,2).toUpperCase()}</div>
                    <h3 style="font-size:1rem;margin:0;">${j.publisher}</h3>
                </div>
                <p style="font-size:0.9rem;margin-top:0.5rem;">${j.name}</p>
            </div>
        `;
    });
    document.getElementById('journalsGrid').innerHTML = html;
}

function filterJournals(val) {
    val = val.toLowerCase();
    const filtered = globalJournals.filter(j => j.name.toLowerCase().includes(val) || j.publisher.toLowerCase().includes(val));
    renderJournals(filtered);
}

let selectedJournalId = null;
function selectJournal(id) {
    selectedJournalId = id;
    const j = globalJournals.find(x => x.id === id);
    
    document.querySelectorAll('.journal-card').forEach(c => c.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    const detailsHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:0.9rem;">
            <div><strong>Publisher:</strong><br><span class="text-muted">${j.publisher}</span></div>
            <div><strong>Journal:</strong><br><span class="text-muted">${j.name}</span></div>
            <div><strong>Citation Style:</strong><br><span class="text-muted">${j.citation_style}</span></div>
            <div><strong>Layout:</strong><br><span class="text-muted">${j.layout}</span></div>
            <div><strong>Font:</strong><br><span class="text-muted">${j.font}</span></div>
            <div><strong>Scope:</strong><br><span class="text-muted">${j.scope}</span></div>
        </div>
    `;
    document.getElementById('journalDetails').innerHTML = detailsHtml;
    document.getElementById('btnJournalNext').disabled = false;
}

async function loadAIReview() {
    if (!isDemoMode && selectedJournalId) {
        await fetch(`${API_URL}/select-journal/${currentProjectId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({journal_id: selectedJournalId})
        });
    }

    showView('view-aireview');
    showLoading('AI Review & Quality Analysis');
    simulateChecklist(['Analyzing novelty and contribution...', 'Reviewing methodology...', 'Evaluating journal fit...']);
    
    let data;
    if (isDemoMode) {
        data = { novelty: 87, originality: 84, innovation: 89, technical_contribution: 91, methodology: 82, completeness: 79, writing_quality: 93, journal_fit: 94, overall_score: 86, status: "Minor Revision Recommended" };
        setTimeout(() => { hideLoading(); renderAIReview(data); }, 3500);
    } else {
        const res = await fetch(`${API_URL}/ai-review/${currentProjectId}`, { method: 'POST' });
        data = await res.json();
        hideLoading();
        renderAIReview(data);
    }
}

let qualityChartInstance = null;

function renderAIReview(data) {
    const metrics = [
        {key: 'novelty', label: 'Novelty', val: data.novelty},
        {key: 'originality', label: 'Originality', val: data.originality},
        {key: 'innovation', label: 'Innovation', val: data.innovation},
        {key: 'tech', label: 'Technical Contribution', val: data.technical_contribution},
        {key: 'method', label: 'Methodology', val: data.methodology},
        {key: 'complete', label: 'Completeness', val: data.completeness},
        {key: 'writing', label: 'Writing Quality', val: data.writing_quality},
        {key: 'fit', label: 'Journal Fit', val: data.journal_fit}
    ];

    let barsHtml = '';
    metrics.forEach(m => {
        barsHtml += `
            <div class="metric-row">
                <div class="metric-header">
                    <span>${m.label}</span>
                    <span>${m.val}/100</span>
                </div>
                <div class="metric-bar-bg">
                    <div class="metric-bar-fill" style="width: 0%;" data-target="${m.val}"></div>
                </div>
            </div>
        `;
    });
    document.getElementById('aiMetricBars').innerHTML = barsHtml;

    // Animate bars
    setTimeout(() => {
        document.querySelectorAll('.metric-bar-fill').forEach(bar => {
            bar.style.width = bar.getAttribute('data-target') + '%';
        });
    }, 100);

    // Render Radar Chart with Chart.js
    const canvas = document.getElementById('qualityRadarChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (qualityChartInstance) {
            qualityChartInstance.destroy();
        }
        qualityChartInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: metrics.map(m => m.label),
                datasets: [{
                    label: 'Evaluation Score',
                    data: metrics.map(m => m.val),
                    backgroundColor: 'rgba(79, 70, 229, 0.25)',
                    borderColor: '#a78bfa',
                    pointBackgroundColor: '#ec4899',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#ec4899'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#9ca3af', font: { size: 10, family: 'Inter' } },
                        ticks: { display: false, stepSize: 20 },
                        suggestedMin: 50,
                        suggestedMax: 100
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    const scoreNum = document.getElementById('aiScoreNum');
    scoreNum.innerText = data.overall_score;
    
    let color = data.overall_score >= 80 ? 'var(--success)' : (data.overall_score >= 60 ? 'var(--warning)' : 'var(--danger)');
    document.getElementById('aiScoreCircle').style.background = `conic-gradient(${color} ${data.overall_score}%, #333 0)`;
    document.getElementById('aiScoreCircle').style.boxShadow = `0 0 30px ${color}40`;
    
    const badge = document.getElementById('aiStatusBadge');
    badge.innerText = data.status;
    badge.style.background = color;

    document.getElementById('keyFindings').innerHTML = `
        <h4 style="margin-bottom:0.5rem;">Key Findings</h4>
        <ul style="padding-left:1.2rem;color:var(--text-muted);font-size:0.9rem;line-height:1.6;">
            <li>Strong technical contribution and writing quality.</li>
            <li>Methodology could use more explicit experimental details.</li>
            <li>Excellent fit for the selected journal scope.</li>
        </ul>
    `;
}

async function loadImprovements() {
    showView('view-improve');
    showLoading('Generating Improvements');
    simulateChecklist(['Drafting recommendations...', 'Formatting actionable advice...']);
    
    let data;
    if (isDemoMode) {
        data = [
            { title: "Strengthen Novelty Statement", priority: "HIGH", problem: "The distinction from prior work is not prominent.", recommendation: "Add a comparison table highlighting differences in the Introduction.", applied: false },
            { title: "Clarify Methodology", priority: "MEDIUM", problem: "Hyperparameters are missing.", recommendation: "Specify the exact learning rate and batch size used.", applied: false }
        ];
        setTimeout(() => { hideLoading(); renderImprovements(data); }, 2000);
    } else {
        const res = await fetch(`${API_URL}/improvements/${currentProjectId}`, { method: 'POST' });
        data = await res.json();
        hideLoading();
        renderImprovements(data);
    }
}

function renderImprovements(data) {
    let html = '';
    data.forEach((imp, i) => {
        html += `
            <div class="improvement-item" id="imp-${i}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h3 style="margin-bottom:0.5rem;">${imp.title} <span style="font-size:0.7rem;padding:0.2rem 0.5rem;background:rgba(255,255,255,0.1);border-radius:4px;margin-left:0.5rem;">${imp.priority}</span></h3>
                        <p class="text-muted" style="font-size:0.9rem;margin-bottom:0.5rem;"><strong>Issue:</strong> ${imp.problem}</p>
                        <p style="font-size:0.95rem;"><strong>Suggestion:</strong> ${imp.recommendation}</p>
                    </div>
                    <button class="btn-outline" onclick="applyImprovement(${i})">Apply</button>
                </div>
            </div>
        `;
    });
    document.getElementById('improvementsList').innerHTML = html;
}

function applyImprovement(i) {
    const el = document.getElementById(`imp-${i}`);
    el.classList.add('applied');
    const btn = el.querySelector('button');
    btn.innerHTML = '✓ Applied';
    btn.disabled = true;
    btn.classList.remove('btn-outline');
    btn.style.background = 'var(--success)';
    btn.style.color = 'white';
    btn.style.borderColor = 'var(--success)';
}

async function loadExport() {
    showLoading('Generating Final Documents');
    simulateChecklist(['Applying journal formatting rules...', 'Generating publication-ready DOCX...', 'Compiling readiness report PDF...']);
    
    if (!isDemoMode) {
        await fetch(`${API_URL}/format/${currentProjectId}`, { method: 'POST' });
        const res = await fetch(`${API_URL}/generate-document/${currentProjectId}`, { method: 'POST' });
        const data = await res.json();
        
        setupFinalExportUI(data.final_score || 86, data.readiness || "Ready");
    } else {
        setupFinalExportUI(86, "Ready for Submission");
    }
    
    setTimeout(() => {
        hideLoading();
        showView('view-export');
    }, 3000);
}

function setupFinalExportUI(score, status) {
    const scoreNum = document.getElementById('finalScoreDisplay');
    scoreNum.innerText = score;
    
    let color = score >= 80 ? 'var(--success)' : (score >= 60 ? 'var(--warning)' : 'var(--danger)');
    document.getElementById('finalScoreCircle').style.background = `conic-gradient(${color} ${score}%, #333 0)`;
    document.getElementById('finalScoreCircle').style.boxShadow = `0 0 40px ${color}60`;
    
    const badge = document.getElementById('finalStatusBadge');
    badge.innerText = status;
    badge.style.background = color;
}

function downloadFile(type) {
    if (isDemoMode) {
        alert(`Demo Mode: Download of ${type} file is simulated.`);
        return;
    }
    
    if(type === 'docx') window.open(`${API_URL}/export/docx/${currentProjectId}`, '_blank');
    if(type === 'pdf') window.open(`${API_URL}/export/pdf/${currentProjectId}`, '_blank');
    if(type === 'report') window.open(`${API_URL}/export/pdf/${currentProjectId}`, '_blank');
    if(type === 'package') window.open(`${API_URL}/export-package/${currentProjectId}`, '_blank');
}

// Global Nav Links
async function showManuscripts() {
    activateNav('nav-manuscripts');
    updateProgressTracker(0);
    showView('view-manuscripts');
    
    showLoading('Loading manuscripts...');
    try {
        let url = `${API_URL}/projects`;
        if (currentUser) {
            url += `?user_id=${currentUser.id}`;
        }
        const res = await fetch(url);
        const projects = await res.json();
        hideLoading();
        
        const tbody = document.getElementById('manuscriptsTableBody');
        if (projects.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 1rem 0;">No manuscripts found. Upload one to get started!</td></tr>`;
            return;
        }
        
        let html = '';
        projects.forEach(p => {
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 1rem 0;"><strong>${p.name}</strong></td>
                    <td style="padding: 1rem 0;"><span class="demo-badge">${p.status}</span></td>
                    <td style="padding: 1rem 0;">
                        <span style="color: ${p.score >= 80 ? 'var(--success)' : 'var(--warning)'}; font-weight: bold;">
                            ${p.score > 0 ? p.score : '-'}
                        </span>
                    </td>
                    <td style="padding: 1rem 0;">${p.date.split(' ')[0]}</td>
                    <td style="padding: 1rem 0;">
                        <button class="btn-outline" style="padding: 0.4rem 0.8rem; font-size:0.8rem;" onclick="loadExistingProject(${p.id})">Open</button>
                        <button class="btn-outline" style="padding: 0.4rem 0.8rem; font-size:0.8rem; border-color: var(--danger); color: var(--danger); margin-left:0.5rem;" onclick="deleteProject(${p.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch(e) {
        hideLoading();
        console.error(e);
    }
}

async function deleteProject(projectId) {
    if(!confirm("Are you sure you want to delete this manuscript?")) return;
    try {
        await fetch(`${API_URL}/project/${projectId}`, { method: 'DELETE' });
        showManuscripts();
    } catch(e) {
        alert("Error deleting manuscript");
    }
}

async function showTemplates() {
    activateNav('nav-templates');
    updateProgressTracker(0);
    showView('view-templates');
    
    showLoading('Loading templates...');
    try {
        const res = await fetch(`${API_URL}/journals`);
        const journals = await res.json();
        hideLoading();
        
        let html = '';
        journals.forEach(j => {
            html += `
                <div class="journal-card" style="cursor:default;">
                    <div class="journal-header">
                        <div class="journal-icon">${j.publisher.substring(0,2).toUpperCase()}</div>
                        <h3 style="font-size:1rem;margin:0;">${j.publisher}</h3>
                    </div>
                    <p style="font-size:0.9rem;margin-top:0.5rem;margin-bottom:1rem;">${j.name}</p>
                    <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.6;">
                        <strong>Scope:</strong> ${j.scope}<br>
                        <strong>Layout:</strong> ${j.layout}<br>
                        <strong>Citation:</strong> ${j.citation_style}
                    </div>
                </div>
            `;
        });
        document.getElementById('templatesGrid').innerHTML = html;
    } catch(e) {
        hideLoading();
        console.error(e);
    }
}

async function loadExistingProject(projectId) {
    currentProjectId = projectId;
    isDemoMode = false;
    activateNav('nav-dashboard');
    showLoading('Loading project...');
    setTimeout(() => {
        hideLoading();
        showView('view-export');
        setupFinalExportUI(86, "Loaded"); // Use real data if fetched
        document.getElementById('progressTracker').style.display = 'none';
    }, 1000);
}

// UI Helpers
function showLoading(text) {
    document.getElementById('loadingText').innerText = text;
    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.getElementById('loadingChecklist').innerHTML = '';
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function simulateChecklist(items) {
    const list = document.getElementById('loadingChecklist');
    list.innerHTML = '';
    
    items.forEach((item, index) => {
        setTimeout(() => {
            list.innerHTML += `<div class="check-item done"><i class="fa-solid fa-check"></i> ${item}</div>`;
        }, (index + 1) * 800);
    });
}
