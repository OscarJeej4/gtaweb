// main.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js';

(() => {
  // Basic Three.js Setup
  let scene, camera, renderer, clock;
  let player, playerVelocity = new THREE.Vector3();
  let keys = {};
  let vehicles = [];
  let aiVehicles = [];
  let buses = [];
  let train;
  let trafficLights = [];
  let raycaster = new THREE.Raycaster();
  let mouse = new THREE.Vector2();
  let shootCooldown = 0;
  const clockDelta = 0.016;

  // Mobile controls state
  let joystick = {
    active: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    deltaX: 0,
    deltaY: 0,
    maxRadius: 50,
  };
  let shootPressed = false;
  let enterPressed = false;

  // Constants
  const MOVE_SPEED = 10;
  const VEHICLE_SPEED = 15;
  const BUS_SPEED = 12;
  const TRAIN_SPEED = 20;
  const CITY_SIZE = 30; // 30x30 blocks (adjust for performance)

  init();

  function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // sky blue

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 2000);
    camera.position.set(0, 15, 30);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Clock
    clock = new THREE.Clock();

    // Lighting
    setupLights();

    // Generate city
    generateCity();

    // Create player
    createPlayer();

    // Setup controls listeners
    setupInput();

    // Start animation loop
    animate();
  }

  // Lights
  function setupLights() {
    // Directional sunlight
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    scene.add(sun);

    // Ambient light
    scene.add(new THREE.AmbientLight(0x404040, 0.8));
  }

  // Generate city with roads, pavements, buildings
  function generateCity() {
    const roadWidth = 6;
    const pavementWidth = 2;
    const blockSize = roadWidth + pavementWidth * 2 + 20; // 20m buildings per block

    // Road texture - simple dark grey material
    const roadMat = new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.7});
    const pavementMat = new THREE.MeshStandardMaterial({color: 0x888888, roughness: 0.9});
    const buildingMat = new THREE.MeshStandardMaterial({color: 0x9999aa, roughness: 0.6, metalness: 0.2});
    const windowMat = new THREE.MeshStandardMaterial({color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0});

    // Create roads and pavements on grid
    for(let x = -CITY_SIZE; x <= CITY_SIZE; x++) {
      for(let z = -CITY_SIZE; z <= CITY_SIZE; z++) {
        const posX = x * blockSize;
        const posZ = z * blockSize;

        // Road: horizontal
        const roadH = new THREE.Mesh(
          new THREE.BoxGeometry(blockSize, 0.1, roadWidth),
          roadMat
        );
        roadH.position.set(posX, 0.05, posZ);
        roadH.receiveShadow = true;
        scene.add(roadH);

        // Road: vertical
        const roadV = new THREE.Mesh(
          new THREE.BoxGeometry(roadWidth, 0.1, blockSize),
          roadMat
        );
        roadV.position.set(posX, 0.05, posZ);
        roadV.receiveShadow = true;
        scene.add(roadV);

        // Pavements around roads
        // Horizontal pavements left/right of horizontal road
        const pavementHL = new THREE.Mesh(
          new THREE.BoxGeometry(blockSize, 0.1, pavementWidth),
          pavementMat
        );
        pavementHL.position.set(posX, 0.06, posZ + roadWidth/2 + pavementWidth/2);
        pavementHL.receiveShadow = true;
        scene.add(pavementHL);

        const pavementHR = pavementHL.clone();
        pavementHR.position.set(posX, 0.06, posZ - roadWidth/2 - pavementWidth/2);
        scene.add(pavementHR);

        // Vertical pavements above/below vertical road
        const pavementVU = new THREE.Mesh(
          new THREE.BoxGeometry(pavementWidth, 0.1, blockSize),
          pavementMat
        );
        pavementVU.position.set(posX + roadWidth/2 + pavementWidth/2, 0.06, posZ);
        pavementVU.receiveShadow = true;
        scene.add(pavementVU);

        const pavementVD = pavementVU.clone();
        pavementVD.position.set(posX - roadWidth/2 - pavementWidth/2, 0.06, posZ);
        scene.add(pavementVD);

        // Buildings in block center - simple box with emissive windows
        const buildingHeight = 10 + Math.random()*30;
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(18, buildingHeight, 18),
          buildingMat
        );
        building.position.set(posX, buildingHeight/2 + 0.1, posZ);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);

        // Windows as emissive planes randomly distributed on building sides
        const windowCount = 40;
        for(let i=0; i<windowCount; i++) {
          const windowGeo = new THREE.PlaneGeometry(1.5, 1.5);
          const win = new THREE.Mesh(windowGeo, windowMat);

          // Randomly select building face
          const face = Math.floor(Math.random() * 4);
          let wx=0, wy=0, wz=0, rotY=0;

          // Position windows randomly on building sides
          wy = Math.random()*buildingHeight - buildingHeight/2 + 1;

          switch(face) {
            case 0: // front
              wx = (Math.random()*16) - 8;
              wz = 9.1;
              rotY = 0;
              break;
            case 1: // back
              wx = (Math.random()*16) - 8;
              wz = -9.1;
              rotY = Math.PI;
              break;
            case 2: // left
              wx = -9.1;
              wz = (Math.random()*16) - 8;
              rotY = -Math.PI/2;
              break;
            case 3: // right
              wx = 9.1;
              wz = (Math.random()*16) - 8;
              rotY = Math.PI/2;
              break;
          }
          win.position.set(wx, wy, wz);
          win.rotation.y = rotY;
          building.add(win);
        }
      }
    }
  }

  // Create player
  function createPlayer() {
    const playerGeo = new THREE.CapsuleGeometry(0.5, 1.2, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({color: 0x0088ff, roughness: 0.5, metalness: 0.1});
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(0, 1.5, 0);
    player.castShadow = true;
    scene.add(player);
  }

  // Input handling
  function setupInput() {
    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('resize', onWindowResize);

    setupMobileControls();
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Mobile joystick & buttons
  function setupMobileControls() {
    const joystickEl = document.getElementById('joystick');
    const btnShoot = document.getElementById('btnShoot');
    const btnEnter = document.getElementById('btnEnter');

    // Joystick touch events
    joystickEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      joystick.active = true;
      const touch = e.touches[0];
      joystick.startX = touch.pageX;
      joystick.startY = touch.pageY;
      joystick.x = 0;
      joystick.y = 0;
    });

    joystickEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!joystick.active) return;
      const touch = e.touches[0];
      joystick.deltaX = touch.pageX - joystick.startX;
      joystick.deltaY = touch.pageY - joystick.startY;

      // Clamp joystick within max radius
      const dist = Math.sqrt(joystick.deltaX*joystick.deltaX + joystick.deltaY*joystick.deltaY);
      if (dist > joystick.maxRadius) {
        const angle = Math.atan2(joystick.deltaY, joystick.deltaX);
        joystick.deltaX = Math.cos(angle) * joystick.maxRadius;
        joystick.deltaY = Math.sin(angle) * joystick.maxRadius;
      }
      joystick.x = joystick.deltaX / joystick.maxRadius;
      joystick.y = -joystick.deltaY / joystick.maxRadius; // Invert Y for forward movement
      joystickEl.style.transform = `translate(${joystick.deltaX}px, ${joystick.deltaY}px)`;
    });

    joystickEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      joystick.active = false;
      joystick.x = 0;
      joystick.y = 0;
      joystickEl.style.transform = 'translate(0,0)';
    });

    // Buttons touch/click
    btnShoot.addEventListener('touchstart', (e) => { e.preventDefault(); shootPressed = true; });
    btnShoot.addEventListener('touchend', (e) => { e.preventDefault(); shootPressed = false; });
    btnShoot.addEventListener('mousedown', () => { shootPressed = true; });
    btnShoot.addEventListener('mouseup', () => { shootPressed = false; });

    btnEnter.addEventListener('touchstart', (e) => { e.preventDefault(); enterPressed = true; });
    btnEnter.addEventListener('touchend', (e) => { e.preventDefault(); enterPressed = false; });
    btnEnter.addEventListener('mousedown', () => { enterPressed = true; });
    btnEnter.addEventListener('mouseup', () => { enterPressed = false; });
  }

  // Animate loop
  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    updatePlayer(delta);
    updateVehicles(delta);
    updateAICars(delta);
    updateBuses(delta);
    updateTrain(delta);
    updateTrafficLights(delta);
    updateShooting(delta);

    updateCamera();

    renderer.render(scene, camera);
  }

  // Player movement & logic
  function updatePlayer(delta) {
    let moveX = 0;
    let moveZ = 0;

    // Desktop input
    if (keys['w'] || keys['arrowup']) moveZ -= 1;
    if (keys['s'] || keys['arrowdown']) moveZ += 1;
    if (keys['a'] || keys['arrowleft']) moveX -= 1;
    if (keys['d'] || keys['arrowright']) moveX += 1;

    // Mobile joystick input overrides if active
    if (joystick.active) {
      moveX = joystick.x;
      moveZ = joystick.y;
    }

    const moveVector = new THREE.Vector3(moveX, 0, moveZ);
    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().multiplyScalar(MOVE_SPEED * delta);
      player.position.add(moveVector);
      playerVelocity.copy(moveVector);
      // Rotate player towards movement direction
      player.rotation.y = Math.atan2(moveVector.x, moveVector.z);
    } else {
      playerVelocity.set(0,0,0);
    }
  }

  // Camera follows player with smooth lag
  let camTarget = new THREE.Vector3();
  function updateCamera() {
    camTarget.copy(player.position);
    camTarget.y += 2;
    camTarget.z += 10;

    camera.position.lerp(camTarget, 0.1);
    camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
  }

// Vehicle Class - basic box with drive controls & enter/exit
  class Vehicle {
    constructor(position, color=0xff0000, type='car') {
      this.type = type;
      this.mesh = this.createMesh(color);
      this.mesh.position.copy(position);
      this.speed = 0;
      this.maxSpeed = (type === 'bus') ? BUS_SPEED : VEHICLE_SPEED;
      this.acceleration = 20;
      this.brakeDeceleration = 30;
      this.turnSpeed = Math.PI; // radians per second
      this.direction = new THREE.Vector3(0,0,1);
      this.isAI = false;
      this.driver = null; // player inside vehicle?
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      scene.add(this.mesh);
    }

    createMesh(color) {
      let geo, mat;
      mat = new THREE.MeshStandardMaterial({color, roughness:0.4, metalness:0.7});
      if (this.type === 'car') {
        geo = new THREE.BoxGeometry(2, 1, 4);
      } else if (this.type === 'bus') {
        geo = new THREE.BoxGeometry(3, 2, 8);
      }
      const mesh = new THREE.Mesh(geo, mat);
      return mesh;
    }

    update(delta) {
      if (this.driver) {
        // Player controlled vehicle
        this.handlePlayerInput(delta);
      } else if(this.isAI) {
        this.aiDrive(delta);
      }

      // Move vehicle forward by speed and direction
      const forwardMove = this.direction.clone().multiplyScalar(this.speed * delta);
      this.mesh.position.add(forwardMove);
    }

    handlePlayerInput(delta) {
      let accelerate = 0;
      let turn = 0;

      // Desktop input
      if (keys['w'] || keys['arrowup']) accelerate = 1;
      if (keys['s'] || keys['arrowdown']) accelerate = -1;
      if (keys['a'] || keys['arrowleft']) turn = 1;
      if (keys['d'] || keys['arrowright']) turn = -1;

      // Mobile joystick
      if (joystick.active) {
        accelerate = joystick.y;
        turn = -joystick.x;
      }

      // Accelerate / brake
      if (accelerate > 0) {
        this.speed += this.acceleration * accelerate * delta;
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
      } else if (accelerate < 0) {
        this.speed += this.brakeDeceleration * accelerate * delta;
        if (this.speed < -this.maxSpeed / 3) this.speed = -this.maxSpeed / 3; // reverse slower
      } else {
        // natural deceleration
        if (this.speed > 0) {
          this.speed -= this.brakeDeceleration * delta;
          if (this.speed < 0) this.speed = 0;
        } else if (this.speed < 0) {
          this.speed += this.brakeDeceleration * delta;
          if (this.speed > 0) this.speed = 0;
        }
      }

      // Turning affects direction if moving
      if (this.speed !== 0) {
        const turnAmount = this.turnSpeed * turn * delta * (this.speed > 0 ? 1 : -1);
        this.mesh.rotation.y += turnAmount;

        // Update forward vector
        this.direction.set(
          Math.sin(this.mesh.rotation.y),
          0,
          Math.cos(this.mesh.rotation.y)
        );
      }
    }

    aiDrive(delta) {
      // Simple AI: go forward and random slight turns
      this.speed = this.maxSpeed * 0.5;

      // Randomly turn a little over time
      if (Math.random() < 0.01) {
        this.mesh.rotation.y += (Math.random() - 0.5) * 0.5;
        this.direction.set(
          Math.sin(this.mesh.rotation.y),
          0,
          Math.cos(this.mesh.rotation.y)
        );
      }
    }

    enter(vehicleDriver) {
      if (this.driver === null) {
        this.driver = vehicleDriver;
        vehicleDriver.visible = false; // hide player mesh inside vehicle
      }
    }

    exit() {
      if (this.driver !== null) {
        this.driver.position.copy(this.mesh.position).add(new THREE.Vector3(2, 0, 0)); // exit to right
        this.driver.visible = true;
        this.driver = null;
      }
    }
  }

  // Spawn some AI cars and buses on roads
  function spawnAIVehicles() {
    for (let i = 0; i < 50; i++) {
      const posX = (Math.random() - 0.5) * CITY_SIZE * 40;
      const posZ = (Math.random() - 0.5) * CITY_SIZE * 40;
      const car = new Vehicle(new THREE.Vector3(posX, 0.5, posZ), 0xff3333, 'car');
      car.isAI = true;
      aiVehicles.push(car);
    }

    for (let i = 0; i < 10; i++) {
      const posX = (Math.random() - 0.5) * CITY_SIZE * 40;
      const posZ = (Math.random() - 0.5) * CITY_SIZE * 40;
      const bus = new Vehicle(new THREE.Vector3(posX, 1, posZ), 0x3333ff, 'bus');
      bus.isAI = true;
      buses.push(bus);
    }
  }

  // Bus route system
  const busRoutePoints = [];
  function createBusRoute() {
    const radius = CITY_SIZE * 15;
    const count = 20;
    for(let i=0; i<count; i++) {
      const angle = (i / count) * Math.PI * 2;
      busRoutePoints.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ));
    }
  }

  // Update buses to follow route points
  function updateBuses(delta) {
    for (const bus of buses) {
      if (!bus.routeIndex) bus.routeIndex = 0;

      const target = busRoutePoints[bus.routeIndex];
      const pos = bus.mesh.position;

      const dir = target.clone().sub(pos);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 2) {
        bus.routeIndex = (bus.routeIndex + 1) % busRoutePoints.length;
      } else {
        dir.normalize();
        // Rotate bus toward target
        const targetAngle = Math.atan2(dir.x, dir.z);
        let angleDiff = targetAngle - bus.mesh.rotation.y;
        angleDiff = ((angleDiff + Math.PI) % (2*Math.PI)) - Math.PI; // normalize angle difference

        bus.mesh.rotation.y += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), bus.turnSpeed * delta);
        bus.direction.set(Math.sin(bus.mesh.rotation.y), 0, Math.cos(bus.mesh.rotation.y));
        bus.speed = bus.maxSpeed;

        bus.mesh.position.add(bus.direction.clone().multiplyScalar(bus.speed * delta));
      }
    }
  }

  // Train class - moves on fixed rail path in a loop
  class Train {
    constructor() {
      this.mesh = this.createTrainMesh();
      this.mesh.position.set(0, 0.5, 0);
      this.speed = TRAIN_SPEED;
      this.pathPoints = this.createRailPath();
      this.currentIndex = 0;
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      scene.add(this.mesh);
    }

    createTrainMesh() {
      const group = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({color: 0x4444aa, roughness: 0.5, metalness: 0.7});
      const bodyGeo = new THREE.BoxGeometry(3, 2, 6);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      group.add(body);

      const wheelsGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 12);
      const wheelsMat = new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.9});
      for (let i=0; i<4; i++) {
        const wheel = new THREE.Mesh(wheelsGeo, wheelsMat);
        wheel.rotation.z = Math.PI/2;
        wheel.position.set(-1 + i%2*2, -1, -2 + Math.floor(i/2)*4);
        wheel.castShadow = true;
        group.add(wheel);
      }
      return group;
    }

    createRailPath() {
      const points = [];
      const radius = CITY_SIZE * 18;
      const segments = 100;
      for(let i=0; i<=segments; i++) {
        const angle = (i/segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(angle)*radius,
          0,
          Math.sin(angle)*radius
        ));
      }
      return points;
    }

    update(delta) {
      if(this.pathPoints.length === 0) return;
      const target = this.pathPoints[(this.currentIndex+1) % this.pathPoints.length];
      const pos = this.mesh.position;

      const dir = target.clone().sub(pos);
      const dist = dir.length();

      if (dist < this.speed * delta) {
        this.currentIndex = (this.currentIndex + 1) % this.pathPoints.length;
        this.mesh.position.copy(target);
      } else {
        dir.normalize();
        this.mesh.position.add(dir.multiplyScalar(this.speed * delta));
      }

      // Rotate train to face movement direction
      const nextIndex = (this.currentIndex + 1) % this.pathPoints.length;
      const nextTarget = this.pathPoints[nextIndex];
      const lookDir = nextTarget.clone().sub(this.mesh.position);
      this.mesh.rotation.y = Math.atan2(lookDir.x, lookDir.z);
    }
  }

  // Traffic light system - simple color cycle
  class TrafficLight {
    constructor(position) {
      this.position = position.clone();
      this.state = 'green'; // green, yellow, red
      this.timer = 0;
      this.cycleDuration = {green: 8, yellow: 2, red: 8};

      this.mesh = this.createMesh();
      this.mesh.position.copy(this.position);
      scene.add(this.mesh);
    }

    createMesh() {
      const group = new THREE.Group();

      const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
      const poleMat = new THREE.MeshStandardMaterial({color: 0x111111});
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2;
      group.add(pole);

      const boxGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
      const boxMat = new THREE.MeshStandardMaterial({color: 0x222222});
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = 3.5;
      group.add(box);

      // Lights
      this.greenLight = this.createLightSphere(0x00ff00);
      this.greenLight.position.set(0, 3.8, 0.3);
      group.add(this.greenLight);

      this.yellowLight = this.createLightSphere(0xffff00);
      this.yellowLight.position.set(0, 3.5, 0.3);
      group.add(this.yellowLight);

      this.redLight = this.createLightSphere(0xff0000);
      this.redLight.position.set(0, 3.2, 0.3);
      group.add(this.redLight);

      return group;
    }

    createLightSphere(color) {
      const geo = new THREE.SphereGeometry(0.1, 8, 8);
      const mat = new THREE.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 0});
      return new THREE.Mesh(geo, mat);
    }

    update(delta) {
      this.timer += delta;
      if (this.timer > this.cycleDuration[this.state]) {
        this.timer = 0;
        if (this.state === 'green') this.state = 'yellow';
        else if (this.state === 'yellow') this.state = 'red';
        else if (this.state === 'red') this.state = 'green';
      }

      // Update emissive intensity for lights
      this.redLight.material.emissiveIntensity = (this.state === 'red') ? 1 : 0;
      this.yellowLight.material.emissiveIntensity = (this.state === 'yellow') ? 1 : 0;
      this.greenLight.material.emissiveIntensity = (this.state === 'green') ? 1 : 0;
    }
  }

  // Shooting mechanic (raycast from camera forward)
  const shootCooldown = 0.5;
  let shootTimer = 0;
  function shoot(delta) {
    shootTimer -= delta;
    if (mouseDown && shootTimer <= 0) {
      shootTimer = shootCooldown;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        console.log('Hit object:', hit.name || hit.id);

        // Optional: add effects, remove objects, etc
      }
    }
  }

  // Globals to hold vehicles, buses, etc
  const aiVehicles = [];
  const buses = [];
  let train;

  // Init function additions
  function initVehiclesAndSystems() {
    spawnAIVehicles();
    createBusRoute();
    train = new Train();

    // Place some traffic lights at intersections (example positions)
    trafficLights.push(new TrafficLight(new THREE.Vector3(20, 0, 0)));
    trafficLights.push(new TrafficLight(new THREE.Vector3(-20, 0, 0)));
    trafficLights.push(new TrafficLight(new THREE.Vector3(0, 0, 20)));
    trafficLights.push(new TrafficLight(new THREE.Vector3(0, 0, -20)));
  }

  // Modify the animate loop to update vehicles, buses, train, traffic lights, shooting
  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Update player controls & vehicle
    if (playerVehicle) {
      playerVehicle.update(delta);
      // Sync player position with vehicle if inside
      if (playerVehicle.driver) {
        player.position.copy(playerVehicle.mesh.position).add(new THREE.Vector3(0, 1.5, 0));
        player.rotation.y = playerVehicle.mesh.rotation.y;
      }
    }

    for (const vehicle of aiVehicles) {
      vehicle.update(delta);
    }

    updateBuses(delta);
    for (const light of trafficLights) {
      light.update(delta);
    }
    if (train) train.update(delta);

    shoot(delta);

    renderer.render(scene, camera);
  }

  // Setup keyboard and mouse for shooting and vehicle entering/exiting
  let mouseDown = false;
  window.addEventListener('mousedown', () => mouseDown = true);
  window.addEventListener('mouseup', () => mouseDown = false);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'e') {
      // Try to enter or exit nearest vehicle
      if (playerVehicle && playerVehicle.driver === player) {
        playerVehicle.exit();
        playerVehicle = null;
      } else {
        // Find nearest vehicle
        let nearest = null;
        let nearestDist = 5;
        for (const vehicle of [...aiVehicles, ...buses]) {
          const dist = vehicle.mesh.position.distanceTo(player.position);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = vehicle;
          }
        }
        if (nearest) {
          nearest.enter(player);
          playerVehicle = nearest;
        }
      }
    }
  });

  // Add arrays and references needed for new code
  const trafficLights = [];
  let playerVehicle = null;

  // Call initVehiclesAndSystems after original init is called
  initVehiclesAndSystems();

  // Start animation loop
  animate();
})();
