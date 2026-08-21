// FindIt Smart Recovery Engine - 3D Interactive Hero Visualization (Three.js)

(function() {
    document.addEventListener("DOMContentLoaded", function() {
        initHero3DVisualization();
    });

    function initHero3DVisualization() {
        const container = document.getElementById("hero-3d-canvas-container");
        if (!container) return;

        // Ensure Three.js is loaded
        if (typeof THREE === 'undefined') {
            console.warn("Three.js not found. Loading fallback static visual.");
            return;
        }

        const width = container.clientWidth || 540;
        const height = container.clientHeight || 440;

        // 1. SCENE SETUP
        const scene = new THREE.Scene();

        // 2. CAMERA SETUP
        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
        camera.position.set(0, 6.5, 11.5);
        camera.lookAt(0, 0, 0);

        // 3. RENDERER
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // 4. LIGHTING
        const ambientLight = new THREE.AmbientLight(0x3b82f6, 0.7);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x06b6d4, 1.6);
        dirLight.position.set(6, 12, 8);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        scene.add(dirLight);

        const purplePointLight = new THREE.PointLight(0xa855f7, 2.5, 12);
        purplePointLight.position.set(0, 3, 0);
        scene.add(purplePointLight);

        const cyanPointLight = new THREE.PointLight(0x06b6d4, 2.0, 10);
        cyanPointLight.position.set(-2.5, 2, -1.2);
        scene.add(cyanPointLight);

        const greenPointLight = new THREE.PointLight(0x10b981, 2.0, 10);
        greenPointLight.position.set(2.5, 2, 1.2);
        scene.add(greenPointLight);

        // MAIN CAMPUS GROUP (Rotates slowly)
        const campusGroup = new THREE.Group();
        scene.add(campusGroup);

        // 5. STYLIZED CAMPUS BASE PLATFORM
        const platformGeo = new THREE.CylinderGeometry(4.4, 4.8, 0.4, 48);
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x0f0d22,
            roughness: 0.35,
            metalness: 0.8,
            wireframe: false
        });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.y = -0.2;
        platform.receiveShadow = true;
        campusGroup.add(platform);

        // Outer Glowing Edge Ring
        const ringGeo = new THREE.TorusGeometry(4.65, 0.06, 16, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
        const outerRing = new THREE.Mesh(ringGeo, ringMat);
        outerRing.rotation.x = Math.PI / 2;
        outerRing.position.y = -0.01;
        campusGroup.add(outerRing);

        // Inner Orbit Grid Rings
        const innerRing1 = new THREE.Mesh(
            new THREE.TorusGeometry(2.8, 0.02, 16, 64),
            new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 })
        );
        innerRing1.rotation.x = Math.PI / 2;
        innerRing1.position.y = 0.01;
        campusGroup.add(innerRing1);

        // 6. LOW-POLY CAMPUS BUILDINGS
        function createBuilding(x, z, width, depth, height, color, glowColor, labelName) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);

            const bGeo = new THREE.BoxGeometry(width, height, depth);
            const bMat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.3,
                metalness: 0.6
            });
            const mesh = new THREE.Mesh(bGeo, bMat);
            mesh.position.y = height / 2;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);

            // Roof Glow Cap
            const roofGeo = new THREE.BoxGeometry(width * 0.9, 0.08, depth * 0.9);
            const roofMat = new THREE.MeshBasicMaterial({ color: glowColor });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.y = height + 0.04;
            group.add(roof);

            // Glowing Node Beacon Sphere above roof
            const nodeGeo = new THREE.SphereGeometry(0.18, 16, 16);
            const nodeMat = new THREE.MeshBasicMaterial({ color: glowColor });
            const node = new THREE.Mesh(nodeGeo, nodeMat);
            node.position.y = height + 0.4;
            group.add(node);

            campusGroup.add(group);
            return { group, nodePos: new THREE.Vector3(x, height + 0.4, z) };
        }

        // Campus Locations
        const cseBlock = createBuilding(-2.5, -1.2, 1.2, 1.0, 0.9, 0x1e1b4b, 0x06b6d4, "CSE Block");
        const library = createBuilding(2.5, 1.2, 1.4, 1.1, 1.1, 0x064e3b, 0x10b981, "Library");
        const readingHall = createBuilding(-1.2, 1.8, 1.0, 0.9, 0.7, 0x311b92, 0xa855f7, "Reading Hall");
        const cafeteria = createBuilding(1.6, -1.8, 1.1, 1.0, 0.6, 0x78350f, 0xf59e0b, "Cafeteria");
        const hostel = createBuilding(-2.2, 1.5, 0.9, 0.8, 0.8, 0x1e293b, 0x3b82f6, "Hostel");

        // 7. GLOWING PATH ROUTES BETWEEN BUILDINGS
        const routePoints1 = [
            cseBlock.nodePos,
            new THREE.Vector3(-1.4, 0.6, -0.2),
            new THREE.Vector3(0, 1.0, 0),
            new THREE.Vector3(1.3, 0.6, 0.6),
            library.nodePos
        ];
        const curve1 = new THREE.CatmullRomCurve3(routePoints1);
        const tubeGeo1 = new THREE.TubeGeometry(curve1, 40, 0.035, 8, false);
        const tubeMat1 = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.6 });
        const tubeMesh1 = new THREE.Mesh(tubeGeo1, tubeMat1);
        campusGroup.add(tubeMesh1);

        const routePoints2 = [
            readingHall.nodePos,
            new THREE.Vector3(-0.6, 0.7, 0.8),
            new THREE.Vector3(0, 1.0, 0)
        ];
        const curve2 = new THREE.CatmullRomCurve3(routePoints2);
        const tubeGeo2 = new THREE.TubeGeometry(curve2, 20, 0.03, 8, false);
        const tubeMat2 = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.5 });
        const tubeMesh2 = new THREE.Mesh(tubeGeo2, tubeMat2);
        campusGroup.add(tubeMesh2);

        // Flowing Light Particles along Curve 1
        const particleCount = 18;
        const particleGeo = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

        const particleMat = new THREE.PointsMaterial({
            color: 0x38bdf8,
            size: 0.16,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });
        const particleSystem = new THREE.Points(particleGeo, particleMat);
        campusGroup.add(particleSystem);

        // 8. PROCEDURAL 3D PRODUCT OBJECT: 🎧 AirPods Charging Case & Earbuds
        const airpodsGroup = new THREE.Group();
        airpodsGroup.position.set(-0.6, 2.3, 0.2);
        scene.add(airpodsGroup);

        // AirPods Case Base
        const caseBodyGeo = new THREE.BoxGeometry(0.95, 0.7, 0.42);
        const caseBodyMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.12,
            metalness: 0.85,
            envMapIntensity: 1.0
        });
        const caseBody = new THREE.Mesh(caseBodyGeo, caseBodyMat);
        caseBody.castShadow = true;
        airpodsGroup.add(caseBody);

        // Case Lid (Slightly open)
        const caseLidGeo = new THREE.BoxGeometry(0.95, 0.35, 0.42);
        const caseLid = new THREE.Mesh(caseLidGeo, caseBodyMat);
        caseLid.position.set(0, 0.45, -0.05);
        caseLid.rotation.x = -0.25;
        airpodsGroup.add(caseLid);

        // Case Status LED Light
        const ledGeo = new THREE.SphereGeometry(0.04, 12, 12);
        const ledMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(0, 0, 0.22);
        airpodsGroup.add(led);

        // Left Earbud Stem & Head
        const earbudMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.1, metalness: 0.9 });
        const leftEarbud = new THREE.Group();
        const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const headMesh = new THREE.Mesh(headGeo, earbudMat);
        const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.24, 12);
        const stemMesh = new THREE.Mesh(stemGeo, earbudMat);
        stemMesh.position.set(0, -0.12, 0);
        leftEarbud.add(headMesh);
        leftEarbud.add(stemMesh);
        leftEarbud.position.set(-0.22, 0.55, 0.05);
        leftEarbud.rotation.z = 0.25;
        airpodsGroup.add(leftEarbud);

        // Right Earbud
        const rightEarbud = leftEarbud.clone();
        rightEarbud.position.set(0.22, 0.58, 0.05);
        rightEarbud.rotation.z = -0.25;
        airpodsGroup.add(rightEarbud);

        // 9. SMART MATCH 94% FLOATING 3D TORUS RING
        const matchRingGroup = new THREE.Group();
        matchRingGroup.position.set(0.8, 2.5, -0.2);
        scene.add(matchRingGroup);

        const matchRingGeo = new THREE.TorusGeometry(0.9, 0.035, 16, 64);
        const matchRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const matchRing = new THREE.Mesh(matchRingGeo, matchRingMat);
        matchRingGroup.add(matchRing);

        const matchOrbitRingGeo = new THREE.TorusGeometry(1.15, 0.015, 16, 64);
        const matchOrbitRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.6 });
        const matchOrbitRing = new THREE.Mesh(matchOrbitRingGeo, matchOrbitRingMat);
        matchRingGroup.add(matchOrbitRing);

        // 10. MOUSE PARALLAX INTERACTION
        let mouseX = 0;
        let mouseY = 0;
        let targetMouseX = 0;
        let targetMouseY = 0;

        window.addEventListener("mousemove", function(e) {
            const rect = container.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            }
        });

        // 11. ANIMATION LOOP
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);

            const elapsedTime = clock.getElapsedTime();

            // Smooth Mouse Interpolation
            targetMouseX += (mouseX - targetMouseX) * 0.05;
            targetMouseY += (mouseY - targetMouseY) * 0.05;

            // Camera Subtle Parallax Tilt
            camera.position.x = targetMouseX * 0.6;
            camera.position.y = 6.5 + targetMouseY * 0.4;
            camera.lookAt(0, 0, 0);

            // Campus Platform Rotation
            campusGroup.rotation.y = elapsedTime * 0.08 + targetMouseX * 0.15;

            // AirPods Floating & Bobbing Movement
            airpodsGroup.position.y = 2.3 + Math.sin(elapsedTime * 1.8) * 0.14;
            airpodsGroup.rotation.y = Math.sin(elapsedTime * 0.9) * 0.25 + targetMouseX * 0.2;
            airpodsGroup.rotation.x = Math.cos(elapsedTime * 0.7) * 0.1;

            // 94% Match Ring Pulse & Rotation
            matchRingGroup.position.y = 2.5 + Math.cos(elapsedTime * 1.5) * 0.12;
            matchRing.rotation.z = elapsedTime * 0.4;
            matchOrbitRing.rotation.z = -elapsedTime * 0.6;
            matchRingGroup.scale.setScalar(1.0 + Math.sin(elapsedTime * 2.5) * 0.05);

            // Flowing Route Particles Along Curve
            const positions = particleGeo.attributes.position.array;
            for (let i = 0; i < particleCount; i++) {
                const t = (elapsedTime * 0.25 + i / particleCount) % 1.0;
                const point = curve1.getPoint(t);
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = point.z;
            }
            particleGeo.attributes.position.needsUpdate = true;

            renderer.render(scene, camera);
        }

        animate();

        // 12. RESPONSIVE RESIZE
        window.addEventListener("resize", function() {
            if (!container) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
    }
})();
