import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { CONFIG } from "./config.js";
import { Boid } from "./Boid.js";
import { createControlPanel } from "./ui.js";


// RENDERER / SCENE / CAMERA

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(CONFIG.background, 1);
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.z = CONFIG.camera.z;
scene.add(camera);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const mainLight = new THREE.DirectionalLight(0xffffff, 3);
mainLight.position.set(20, 30, 30);
scene.add(mainLight);

const secondaryLight = new THREE.DirectionalLight(0x6688ff, 1);
secondaryLight.position.set(-20, -10, 10);
scene.add(secondaryLight);


// FISH MODEL

async function loadFishModel(url, targetSize) {
  const lowerUrl = url.toLowerCase();
  let model;

  if (lowerUrl.endsWith(".glb") || lowerUrl.endsWith(".gltf")) {
    model = (await new GLTFLoader().loadAsync(url)).scene;
  } else if (lowerUrl.endsWith(".fbx")) {
    model = await new FBXLoader().loadAsync(url);
  } else {
    throw new Error("Unsupported fish model format. Use GLB, GLTF or FBX.");
  }

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);

  // Normalizes models from different sources to the same maximum dimension.
  if (largestDimension > 0) {
    model.scale.multiplyScalar(targetSize / largestDimension);
  }

  model.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());

  // Centers the model so boid position and rotation operate around its geometry.
  model.position.sub(center);

  const group = new THREE.Group();
  group.add(model);
  return group;
}

function createFallbackModel() {
  console.warn("Fish model could not be loaded. Using a cone instead.");

  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 3, 16),
    new THREE.MeshStandardMaterial({
      color: 0x55ddaa,
      roughness: 0.55,
      metalness: 0.05,
      flatShading: true,
    }),
  );

  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

let fishTemplate;
try {
  fishTemplate = await loadFishModel(CONFIG.fish.url, CONFIG.fish.targetSize);
} catch (error) {
  console.error(error);
  fishTemplate = createFallbackModel();
}


// BOUNDS

const boundsBox = new THREE.Box3(
  new THREE.Vector3(CONFIG.bounds.x[0], CONFIG.bounds.y[0], CONFIG.bounds.z[0]),
  new THREE.Vector3(CONFIG.bounds.x[1], CONFIG.bounds.y[1], CONFIG.bounds.z[1]),
);
scene.add(new THREE.Box3Helper(boundsBox, 0x667080));


// BOIDS

const boids = [];

function createBoid() {
  const boid = new Boid(scene, fishTemplate, CONFIG);
  boids.push(boid);
  return boid;
}

function setBoidCount(value) {
  const target = Math.max(1, Math.round(value));
  CONFIG.boidCount = target;

  while (boids.length < target) createBoid();
  while (boids.length > target) scene.remove(boids.pop().mesh);
}

function setCruiseSpeed(value) {
  CONFIG.boid.cruiseSpeed = value;

  // Updates existing boids immediately without changing their current direction.
  for (const boid of boids) {
    if (boid.velocity.lengthSq() > 0) {
      boid.velocity.normalize().multiplyScalar(value);
    }
  }
}

function setMaxSpeed(value) {
  CONFIG.boid.maxSpeed = value;

  // Existing velocities are clamped immediately to respect the new limit.
  for (const boid of boids) {
    boid.velocity.clampLength(0, value);
  }
}

setBoidCount(CONFIG.boidCount);


// MOUSE INTERACTION

const mouseNdc = new THREE.Vector2();
const mousePixels = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
const raycaster = new THREE.Raycaster();
let mouseMode = null;
let panel;
let toggle;

const cursorCircle = document.createElement("div");
Object.assign(cursorCircle.style, {
  position: "fixed",
  border: "2px solid rgba(255,255,255,0.92)",
  borderRadius: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  zIndex: "1000",
  boxSizing: "border-box",
  backdropFilter: "blur(2px)",
  left: `${mousePixels.x}px`,
  top: `${mousePixels.y}px`,
});
document.body.appendChild(cursorCircle);

function updateCursorSize() {
  const diameter = CONFIG.mouseInteraction.visualRadiusPx * 2;
  cursorCircle.style.width = `${diameter}px`;
  cursorCircle.style.height = `${diameter}px`;
}

function updateCursorColor() {
  const colors = {
    repel: ["#ff5f5f", "0 0 18px rgba(255,95,95,0.18)"],
    attract: ["#56a8ff", "0 0 18px rgba(86,168,255,0.18)"],
  };
  const [border, shadow] = colors[mouseMode] ?? [
    "rgba(255,255,255,0.92)",
    "0 0 14px rgba(255,255,255,0.08)",
  ];

  cursorCircle.style.borderColor = border;
  cursorCircle.style.boxShadow = shadow;
}

function isUIElement(target) {
  return panel?.contains(target) || toggle?.contains(target);
}

window.addEventListener("pointermove", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mousePixels.set(event.clientX - rect.left, event.clientY - rect.top);

  // Raycasting uses normalized device coordinates while boid influence uses pixels.
  mouseNdc.set(
    (mousePixels.x / rect.width) * 2 - 1,
    -(mousePixels.y / rect.height) * 2 + 1,
  );
  cursorCircle.style.left = `${event.clientX}px`;
  cursorCircle.style.top = `${event.clientY}px`;
});

window.addEventListener("pointerdown", (event) => {
  if (isUIElement(event.target)) return;
  if (event.button === 0) mouseMode = "repel";
  if (event.button === 2) mouseMode = "attract";
  updateCursorColor();
});

window.addEventListener("pointerup", () => {
  mouseMode = null;
  updateCursorColor();
});

window.addEventListener("contextmenu", (event) => {
  if (!isUIElement(event.target)) event.preventDefault();
});

window.addEventListener("blur", () => {
  mouseMode = null;
  updateCursorColor();
});

updateCursorSize();
updateCursorColor();


// CONTROL PANEL

const controls = [
  {
    title: "Population",
    controls: [
      { label: "Nombre de poissons", path: "boidCount", min: 1, max: 200, step: 1, onChange: setBoidCount },
    ],
  },
  {
    title: "Déplacement",
    controls: [
      { label: "Vitesse cible de croisière (u/s)", path: "boid.cruiseSpeed", min: 1, max: 30, step: 0.5, onChange: setCruiseSpeed },
      { label: "Vitesse maximale (u/s)", path: "boid.maxSpeed", min: 1, max: 50, step: 0.5, onChange: setMaxSpeed },
      { label: "Accélération maximale (u/s²)", path: "boid.maxAcceleration", min: 0.5, max: 50, step: 0.5 },
      { label: "Temps de réaction aux changements (s)", path: "boid.steeringResponseTime", min: 0.1, max: 5, step: 0.1 },
    ],
  },
  {
    title: "Perception",
    controls: [
      { label: "Rayon de perception (u)", path: "boid.perceptionRadius", min: 1, max: 30, step: 0.5 },
      { label: "Angle total du cône de perception (°)", path: "boid.perceptionAngle", min: 20, max: 360, step: 5 },
      { label: "Rayon de l’espace personnel (u)", path: "boid.personalSpaceRadius", min: 0.5, max: 15, step: 0.5 },
    ],
  },
  {
    title: "Règles des boids",
    controls: [
      { label: "Intensité de séparation", path: "boid.separationStrength", min: 0, max: 5, step: 0.05 },
      { label: "Intensité d’alignement", path: "boid.alignmentStrength", min: 0, max: 5, step: 0.05 },
      { label: "Intensité de cohésion", path: "boid.cohesionStrength", min: 0, max: 5, step: 0.05 },
      { label: "Progressivité de la séparation", path: "boid.separationFalloffExponent", min: 0.5, max: 5, step: 0.1 },
    ],
  },
  {
    title: "Évitement des limites",
    controls: [
      { label: "Marge avant les parois (u)", path: "boundsAvoidance.margin", min: 0.5, max: 15, step: 0.5 },
      { label: "Intensité d’évitement des parois", path: "boundsAvoidance.strength", min: 0, max: 5, step: 0.05 },
      { label: "Progressivité d’évitement des parois", path: "boundsAvoidance.falloffExponent", min: 0.5, max: 5, step: 0.1 },
    ],
  },
  {
    title: "Interaction avec la souris",
    controls: [
      { label: "Rayon visuel du curseur (px)", path: "mouseInteraction.visualRadiusPx", min: 5, max: 100, step: 1, onChange: updateCursorSize },
      { label: "Rayon réel d’influence (px)", path: "mouseInteraction.effectRadiusPx", min: 10, max: 400, step: 5 },
      { label: "Intensité attraction / répulsion", path: "mouseInteraction.strength", min: 0, max: 10, step: 0.1 },
      { label: "Progressivité de l’effet souris", path: "mouseInteraction.falloffExponent", min: 0.5, max: 5, step: 0.1 },
    ],
  },
];

({ panel, toggle } = createControlPanel(CONFIG, controls));


// ANIMATION

let previousTimestamp = null;

function render(timestamp) {
  requestAnimationFrame(render);

  // Caps large frame gaps to keep the simulation stable after stalls or tab switches.
  const dt = previousTimestamp === null
    ? 0
    : Math.min((timestamp - previousTimestamp) / 1000, 0.05);
  previousTimestamp = timestamp;

  raycaster.setFromCamera(mouseNdc, camera);
  const mouseInteraction = {
    ray: raycaster.ray,
    mouse: mousePixels,
    mode: mouseMode,
    camera,
    viewportWidth: renderer.domElement.clientWidth,
    viewportHeight: renderer.domElement.clientHeight,
  };

  // Compute every acceleration first so all boids react to the same simulation state.
  for (const boid of boids) boid.calculateAcceleration(boids, mouseInteraction);
  for (const boid of boids) boid.update(dt);

  renderer.render(scene, camera);
}

requestAnimationFrame(render);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});