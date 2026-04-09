// ==========================================
        // DEFAULTS & CONFIGURATION
        // ==========================================
        const defaults = {
            modelUrl: 'https://ik.imagekit.io/sqiqig7tz/Jump2.fbx',
            animationSpeed: 0.6,
            modelScale: 0.1,
            modelColor: '#383838', // Light gray color for the model
            terrainSpeed: 12.0,
            sunIntensity: 4.5,
            sunHeight: 45,
            starCount: 18000,
            starBaseSize: 9.0,
            twinkleSpeed: 1.5,
            heightDamping: 8.5,
            earthScale: 0.8, // Decreased by 20%
            earthBrightness: 2.2, // Added brightness parameter
            earthPosX: -890,
            earthPosY: 30,
            earthPosZ: 0
        };

        // ==========================================
        // SCENE SETUP
        // ==========================================
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.0025);

        const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.set(130, 35, 0); 
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 10, 0);
        controls.maxPolarAngle = Math.PI / 2 - 0.1;
        controls.enableDamping = true;
        controls.update();

        // ==========================================
        // LIGHTING
        // ==========================================
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        scene.add(ambientLight);

        // Main Sun (affects everything: terrain, rocks, Earth, and the character)
        const sunLight = new THREE.DirectionalLight(0xfffaf0, defaults.sunIntensity);
        sunLight.position.set(150, defaults.sunHeight, 70);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 600;
        sunLight.shadow.camera.left = -200;
        sunLight.shadow.camera.right = 200;
        sunLight.shadow.camera.top = 200;
        sunLight.shadow.camera.bottom = -200;
        sunLight.shadow.bias = -0.0005;
        scene.add(sunLight);

        // ==========================================
        // TEXTURE GENERATION
        // ==========================================
        function createLunarSandTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#888888';
            ctx.fillRect(0, 0, 512, 512);
            const imageData = ctx.getImageData(0, 0, 512, 512);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * 85;
                data[i] += noise; data[i+1] += noise; data[i+2] += noise;
            }
            ctx.putImageData(imageData, 0, 0);
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(8, 8);
            return texture;
        }
        const sandTexture = createLunarSandTexture();

        // ==========================================
        // BACKGROUND EARTH
        // ==========================================
        const earthGroup = new THREE.Group();
        
        // Use a public domain / open source Earth texture from Three.js examples
        const earthTextureUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg';
        const earthGeometry = new THREE.SphereGeometry(35, 64, 64);
        const earthTex = new THREE.TextureLoader().load(earthTextureUrl);
        earthTex.encoding = THREE.sRGBEncoding; // Corrects color mapping and prevents visual stretching
        
        // Using MeshBasicMaterial so it ignores scene lighting and is always fully visible
        const earthMaterial = new THREE.MeshBasicMaterial({
            map: earthTex,
            color: 0xffffff,
            fog: false // Prevent scene fog from fading out the Earth
        });
        
        // Apply initial brightness
        earthMaterial.color.setScalar(defaults.earthBrightness);
        
        const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
        
        // Fix rotation: align the equator directly to the camera to prevent distorted pole views
        earthMesh.rotation.set(0.1, Math.PI / 2, 0); 
        
        // Positioned far in the background
        earthGroup.position.set(defaults.earthPosX, defaults.earthPosY, defaults.earthPosZ);
        earthGroup.scale.setScalar(defaults.earthScale); // Correctly apply initial scale on load
        earthGroup.add(earthMesh);
        scene.add(earthGroup);

        // ==========================================
        // SEAMLESS NOISE & SMOOTH CRATERS
        // ==========================================
        function hash(x, z) {
            let h = x * 12.9898 + z * 78.233;
            return Math.abs(Math.sin(h) * 43758.5453) % 1;
        }

        function smoothStep(t) {
            return t * t * (3 - 2 * t);
        }

        function getLunarHeight(x, z) {
            let y = 0;
            y += Math.sin(x * 0.015) * Math.cos(z * 0.015) * 5.0;
            y += Math.sin(x * 0.04 + z * 0.03) * 2.0;
            y += Math.sin(x * 0.15) * Math.sin(z * 0.15) * 0.8;
            y += Math.sin(x * 0.5) * Math.cos(z * 0.5) * 0.3; 

            const cellSize = 85;
            const cellX = Math.floor(x / cellSize);
            const cellZ = Math.floor(z / cellSize);
            
            for(let i = -1; i <= 1; i++) {
                for(let j = -1; j <= 1; j++) {
                    const seed = (cellX + i) * 131 + (cellZ + j);
                    const cx = (cellX + i) * cellSize + hash(seed, seed) * cellSize;
                    const cz = (cellZ + j) * cellSize + hash(seed + 1, seed - 1) * cellSize;
                    
                    const dx = x - cx;
                    const dz = z - cz;
                    const dist = Math.sqrt(dx*dx + dz*dz);
                    
                    const craterRadius = 10 + hash(seed, cellZ) * 20;
                    const craterDepth = craterRadius * 0.5;

                    if (dist < craterRadius * 2.0) {
                        const r = dist / craterRadius;
                        if (r < 1.0) {
                            const bowl = Math.cos(r * Math.PI * 0.5); 
                            y -= craterDepth * bowl;
                            y += (1.0 - r) * Math.sin(x * 0.9) * 0.4;
                        } else if (r < 1.8) {
                            const rimPeak = 1.25;
                            const rimEnd = 1.8;
                            const rimMaxH = craterDepth * 0.25;
                            if (r < rimPeak) {
                                const t = (r - 1.0) / (rimPeak - 1.0);
                                y += rimMaxH * smoothStep(t);
                            } else {
                                const t = (rimEnd - r) / (rimEnd - rimPeak);
                                y += rimMaxH * smoothStep(t);
                            }
                        }
                    }
                }
            }
            return y;
        }

        const TERRAIN_SIZE = 400;
        const SEGMENTS = 180;

        const rockGeo = new THREE.DodecahedronGeometry(1, 1);
        const rockMat = new THREE.MeshStandardMaterial({ 
            color: 0x777777, roughness: 0.9, bumpMap: sandTexture, bumpScale: 0.3 
        });

        function createRockField(parent) {
            const rocks = new THREE.Group();
            for (let i = 0; i < 40; i++) {
                const mesh = new THREE.Mesh(rockGeo, rockMat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                // Leave rocks on layer 0 by default
                rocks.add(mesh);
            }
            parent.add(rocks);
            return rocks;
        }

        function randomizeRocks(rockGroup, segmentZPos, globalZOffset) {
            rockGroup.children.forEach((rock, i) => {
                const localX = (hash(i, segmentZPos) - 0.5) * TERRAIN_SIZE * 0.95;
                const localZ = (hash(i + 55, segmentZPos) - 0.5) * TERRAIN_SIZE * 0.95;
                const worldZ = segmentZPos + localZ + globalZOffset;
                const y = getLunarHeight(localX, worldZ);
                rock.position.set(localX, y - 0.35, localZ);
                const s = 0.5 + hash(i + 12, i) * 1.5;
                rock.scale.set(s, s * (0.6 + Math.random() * 0.4), s);
                rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            });
        }

        function updateTerrainGeometry(geometry, zGlobalOffset) {
            const positions = geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const z = positions[i + 2] + zGlobalOffset;
                positions[i + 1] = getLunarHeight(x, z);
            }
            geometry.attributes.position.needsUpdate = true;
            geometry.computeVertexNormals();
        }

        function createTerrainMesh(zInitialPos) {
            const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
            geometry.rotateX(-Math.PI / 2);
            updateTerrainGeometry(geometry, zInitialPos);
            const material = new THREE.MeshStandardMaterial({
                color: 0x999999, roughness: 0.85, metalness: 0.0,
                bumpMap: sandTexture, bumpScale: 0.22, roughnessMap: sandTexture
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.position.z = zInitialPos;
            const rocks = createRockField(mesh);
            randomizeRocks(rocks, zInitialPos, 0);
            return { mesh, rocks };
        }

        const t1 = createTerrainMesh(0);
        const t2 = createTerrainMesh(TERRAIN_SIZE);
        scene.add(t1.mesh, t2.mesh);

        let globalZOffset = 0;

        // ==========================================
        // TWINKLING STARS
        // ==========================================
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = []; const starSizes = []; const starPhases = [];
        for (let i = 0; i < defaults.starCount; i++) {
            const r = 980;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            starPositions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
            starSizes.push(Math.random() * defaults.starBaseSize + 2.0);
            starPhases.push(Math.random() * Math.PI * 2);
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
        starGeometry.setAttribute('phase', new THREE.Float32BufferAttribute(starPhases, 1));

        const starMaterial = new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 }, twinkleSpeed: { value: defaults.twinkleSpeed } },
            vertexShader: `
                attribute float size; attribute float phase; varying float vOpacity; uniform float time; uniform float twinkleSpeed;
                void main() {
                    vOpacity = 0.3 + 0.7 * sin(time * twinkleSpeed + phase);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (550.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vOpacity;
                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    if (dist > 0.5) discard;
                    gl_FragColor = vec4(1.0, 1.0, 1.0, vOpacity * (1.0 - dist * 2.0));
                }
            `,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
        });
        scene.add(new THREE.Points(starGeometry, starMaterial));

        // ==========================================
        // FBX MODEL LOADING
        // ==========================================
        let mixer, fbxModel;
        const clock = new THREE.Clock();
        const loadingDiv = document.getElementById('loading');

        function updateModelMaterial() {
            if (!fbxModel) return;
            const color = new THREE.Color(defaults.modelColor);
            fbxModel.traverse(child => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(m => {
                        m.color.copy(color); // Apply the selected base color
                        
                        // CRITICAL FIX: Remove original texture map and vertex colors 
                        // so the solid Base Color is actually visible
                        m.map = null;
                        m.vertexColors = false;
                        m.needsUpdate = true; // Force Three.js to recompile the material
                        
                        if (m.emissive) m.emissive.setHex(0x000000); // Keep shadows natural
                    });
                }
            });
        }

        new THREE.FBXLoader().load(defaults.modelUrl, (object) => {
            loadingDiv.style.display = 'none';
            fbxModel = object;
            fbxModel.scale.setScalar(defaults.modelScale);
            fbxModel.traverse(child => { 
                if (child.isMesh) { 
                    child.castShadow = true; 
                    child.receiveShadow = true; 
                } 
            });

            updateModelMaterial(); // Apply initial light gray color

            if (object.animations?.length) { 
                mixer = new THREE.AnimationMixer(object); 
                mixer.clipAction(object.animations[0]).play(); 
            }
            scene.add(fbxModel);
        });

        // ==========================================
        // GUI CONTROLS
        // ==========================================
        const gui = new lil.GUI({ title: 'Scene Settings' });
        gui.close(); // Hide panel by default
        
        const charFolder = gui.addFolder('Character Appearance');
        charFolder.add(defaults, 'modelScale', 0.01, 2.0, 0.01).name('Scale').onChange(v => fbxModel?.scale.setScalar(v));
        charFolder.addColor(defaults, 'modelColor').name('Base Color').onChange(updateModelMaterial);
        charFolder.add(defaults, 'animationSpeed', 0, 2, 0.1).name('Anim Speed').onChange(v => mixer && (mixer.timeScale = v));
        charFolder.add(defaults, 'heightDamping', 1.0, 20.0, 0.1).name('Navigation Smoothness');

        const worldFolder = gui.addFolder('Environment');
        worldFolder.add(defaults, 'terrainSpeed', 0, 100, 1).name('Scroll Speed');
        worldFolder.add(defaults, 'sunIntensity', 0, 15, 0.1).name('Sun Power').onChange(v => {
            sunLight.intensity = v;
        });
        worldFolder.add(defaults, 'earthScale', 0.1, 5.0, 0.1).name('Earth Size').onChange(v => {
            earthGroup.scale.setScalar(v);
        });
        worldFolder.add(defaults, 'earthBrightness', 0.0, 5.0, 0.1).name('Earth Brightness').onChange(v => {
            earthMaterial.color.setScalar(v);
        });
        worldFolder.add(defaults, 'earthPosX', -2000, 2000, 10).name('Earth X Position').onChange(v => earthGroup.position.x = v);
        worldFolder.add(defaults, 'earthPosY', -500, 1000, 10).name('Earth Y Position').onChange(v => earthGroup.position.y = v);
        worldFolder.add(defaults, 'earthPosZ', -2000, 2000, 10).name('Earth Z Position').onChange(v => earthGroup.position.z = v);
        worldFolder.add(defaults, 'starBaseSize', 1, 30, 0.5).name('Star Size');

        // ==========================================
        // ANIMATION LOOP (SINGLE-PASS RENDERING)
        // ==========================================
        function animate() {
            requestAnimationFrame(animate);
            const delta = Math.min(clock.getDelta(), 0.05); 
            const time = clock.getElapsedTime();

            starMaterial.uniforms.time.value = time;

            // Slowly rotate the Earth
            if (earthMesh) {
                earthMesh.rotation.y += delta * 0.05;
            }

            const moveStep = defaults.terrainSpeed * delta;
            globalZOffset += moveStep;
            
            t1.mesh.position.z -= moveStep;
            t2.mesh.position.z -= moveStep;

            if (t1.mesh.position.z <= -TERRAIN_SIZE) {
                t1.mesh.position.z += TERRAIN_SIZE * 2;
                updateTerrainGeometry(t1.mesh.geometry, t1.mesh.position.z + globalZOffset);
                randomizeRocks(t1.rocks, t1.mesh.position.z, globalZOffset);
            }
            if (t2.mesh.position.z <= -TERRAIN_SIZE) {
                t2.mesh.position.z += TERRAIN_SIZE * 2;
                updateTerrainGeometry(t2.mesh.geometry, t2.mesh.position.z + globalZOffset);
                randomizeRocks(t2.rocks, t2.mesh.position.z, globalZOffset);
            }

            if (fbxModel) {
                if (mixer) mixer.update(delta * defaults.animationSpeed);
                const targetY = getLunarHeight(0, globalZOffset);
                fbxModel.position.y = THREE.MathUtils.damp(
                    fbxModel.position.y, 
                    targetY, 
                    defaults.heightDamping, 
                    delta
                );
            }

            controls.update();

            // Single pass rendering
            renderer.render(scene, camera);
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();