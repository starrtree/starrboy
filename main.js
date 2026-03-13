import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

const app = document.querySelector("#app");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x140500, 0.06);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 5.75, 13.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 9;
controls.maxDistance = 16;
controls.minPolarAngle = 0.95;
controls.maxPolarAngle = 1.68;
controls.target.set(0, 3.25, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;
controls.dampingFactor = 0.06;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(
  new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.05,
    0.7,
    0.18
  )
);

const warmGlowTexture = createGlowTexture();
const starGlowTexture = createStarTexture();

const bodyMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xf3a028,
  roughness: 0.67,
  metalness: 0.03,
  clearcoat: 0.16,
  clearcoatRoughness: 0.82,
  emissive: 0x2f1000,
  emissiveIntensity: 0.1,
});

const stageMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x221008,
  roughness: 0.32,
  metalness: 0.16,
  clearcoat: 0.48,
  clearcoatRoughness: 0.34,
});

scene.add(createLights());
scene.add(createBackdropAura());

const stage = createStage();
scene.add(stage.group);

const character = createCharacter(bodyMaterial, warmGlowTexture);
character.root.position.y = 1.06;
scene.add(character.root);

const ribbonRig = createRibbonRig();
ribbonRig.group.position.y = 3.05;
scene.add(ribbonRig.group);

const orbitSparkles = createSparkleSwarm(34, {
  texture: starGlowTexture,
  colorChoices: [0xfff0bf, 0xffd26e, 0xffa243],
  radiusRange: [2.8, 4.3],
  depthRange: [1.7, 3.15],
  heightRange: [1.8, 5.6],
  scaleRange: [0.16, 0.34],
  speedRange: [0.18, 0.38],
  verticalRange: [0.08, 0.34],
  opacityRange: [0.45, 0.95],
});
scene.add(orbitSparkles.group);

const backgroundSparkles = createSparkleSwarm(68, {
  texture: warmGlowTexture,
  colorChoices: [0xfff1c8, 0xffbf61, 0xff8f37],
  radiusRange: [5.7, 10.2],
  depthRange: [3.5, 8.5],
  heightRange: [0.8, 7.8],
  scaleRange: [0.12, 0.38],
  speedRange: [0.04, 0.16],
  verticalRange: [0.02, 0.16],
  opacityRange: [0.15, 0.55],
});
scene.add(backgroundSparkles.group);

const companionStars = createCompanionStars(starGlowTexture);
scene.add(companionStars.group);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const elapsed = clock.getElapsedTime();

  updateCharacter(character, elapsed);
  updateRibbonRig(ribbonRig, elapsed);
  updateSparkleSwarm(orbitSparkles, elapsed, 1);
  updateSparkleSwarm(backgroundSparkles, elapsed, 0.55);
  updateCompanionStars(companionStars, elapsed);
  animateStage(stage, elapsed);

  controls.update();
  composer.render();
});

window.addEventListener("resize", onWindowResize);

function createLights() {
  const rig = new THREE.Group();

  const hemisphere = new THREE.HemisphereLight(0xfff1c4, 0x140500, 1.55);
  rig.add(hemisphere);

  const key = new THREE.SpotLight(0xffdf9d, 250, 42, Math.PI / 5.1, 0.52, 1.08);
  key.position.set(7.6, 12.5, 10.2);
  key.target.position.set(0, 3.25, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00008;
  rig.add(key);
  rig.add(key.target);

  const fill = new THREE.PointLight(0xffb45e, 34, 18, 2.2);
  fill.position.set(0, 4.8, 5.6);
  rig.add(fill);

  const rim = new THREE.DirectionalLight(0xff923d, 2.5);
  rim.position.set(-7.6, 7.2, -8.4);
  rig.add(rim);

  const lowBounce = new THREE.PointLight(0xff6e20, 11, 12, 2);
  lowBounce.position.set(0, 1.1, 0);
  rig.add(lowBounce);

  const faceShine = new THREE.PointLight(0xfff0bd, 18, 10, 1.8);
  faceShine.position.set(0, 4.1, 2.6);
  rig.add(faceShine);

  return rig;
}

function createBackdropAura() {
  const auraGroup = new THREE.Group();
  auraGroup.position.set(0, 4.1, -2.4);

  const bigAura = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: warmGlowTexture,
      color: new THREE.Color(1.55, 0.92, 0.4),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  bigAura.scale.set(11.5, 11.5, 1);
  auraGroup.add(bigAura);

  const smallAura = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: warmGlowTexture,
      color: new THREE.Color(2.3, 1.35, 0.5),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  smallAura.scale.set(7.4, 7.4, 1);
  auraGroup.add(smallAura);

  return auraGroup;
}

function createStage() {
  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.25, 5.65, 1.12, 72), stageMaterial);
  base.castShadow = true;
  base.receiveShadow = true;
  base.position.y = 0.55;
  group.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(4.48, 4.86, 0.18, 72),
    new THREE.MeshPhysicalMaterial({
      color: 0x4b230d,
      roughness: 0.24,
      metalness: 0.08,
      clearcoat: 0.6,
      clearcoatRoughness: 0.28,
      emissive: 0x2d1104,
      emissiveIntensity: 0.4,
    })
  );
  top.castShadow = true;
  top.receiveShadow = true;
  top.position.y = 1.1;
  group.add(top);

  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(4.37, 0.08, 16, 180),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.7, 1.05, 0.38),
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 1.18;
  group.add(trim);

  const underGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: warmGlowTexture,
      color: new THREE.Color(1.4, 0.7, 0.28),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  underGlow.scale.set(8.8, 4.4, 1);
  underGlow.position.set(0, 1.15, 0);
  group.add(underGlow);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(18, 96),
    new THREE.ShadowMaterial({ opacity: 0.28 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  group.add(floor);

  return { group, trim, underGlow };
}

function animateStage(stage, elapsed) {
  stage.trim.rotation.z = elapsed * 0.15;
  stage.underGlow.material.opacity = 0.34 + Math.sin(elapsed * 1.1) * 0.06;
}

function createCharacter(material, glowTexture) {
  const root = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.82, 1.54, 14, 28), material);
  body.position.y = 1.88;
  body.scale.set(0.82, 1.08, 0.8);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 28), material);
  belly.position.set(0, 1.2, 0.02);
  belly.scale.set(1.1, 0.92, 0.98);
  belly.castShadow = true;
  belly.receiveShadow = true;
  root.add(belly);

  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.84, 28, 28), material);
  shoulders.position.set(0, 2.55, 0.02);
  shoulders.scale.set(1.64, 0.76, 1.02);
  shoulders.castShadow = true;
  shoulders.receiveShadow = true;
  root.add(shoulders);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.98, 2.55, 0.02);
  root.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.98, 2.55, 0.02);
  root.add(rightArmPivot);

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 1.45, 10, 18), material);
  leftArm.rotation.z = Math.PI / 2;
  leftArm.position.x = -0.9;
  leftArm.castShadow = true;
  leftArm.receiveShadow = true;
  leftArmPivot.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 1.45, 10, 18), material);
  rightArm.rotation.z = Math.PI / 2;
  rightArm.position.x = 0.9;
  rightArm.castShadow = true;
  rightArm.receiveShadow = true;
  rightArmPivot.add(rightArm);

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.62, 10, 18), material);
  leftLeg.position.set(-0.35, 0.48, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.62, 10, 18), material);
  rightLeg.position.set(0.35, 0.48, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  root.add(rightLeg);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 4.12, 0.05);
  root.add(headGroup);

  const head = new MarchingCubes(54, material, true, true);
  head.isolation = 42;
  head.scale.set(2.65, 2.7, 1.78);
  head.castShadow = true;
  head.receiveShadow = true;
  headGroup.add(head);

  const faceGroup = new THREE.Group();
  faceGroup.position.z = 1.03;
  headGroup.add(faceGroup);

  const faceMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  faceMaterial.color = new THREE.Color(2.6, 2.15, 0.95);

  const leftEye = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 8, 16), faceMaterial);
  leftEye.position.set(-0.66, 0.08, 0);
  faceGroup.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 8, 16), faceMaterial);
  rightEye.position.set(0.66, 0.08, 0);
  faceGroup.add(rightEye);

  const smileCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-0.36, -0.42, 0),
    new THREE.Vector3(-0.14, -0.72, 0),
    new THREE.Vector3(0.16, -0.72, 0),
    new THREE.Vector3(0.38, -0.42, 0)
  );
  const smile = new THREE.Mesh(new THREE.TubeGeometry(smileCurve, 40, 0.08, 14, false), faceMaterial);
  faceGroup.add(smile);

  const faceGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(1.7, 1.1, 0.4),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  faceGlow.scale.set(2.9, 2.9, 1);
  faceGlow.position.set(0, -0.08, -0.06);
  faceGroup.add(faceGlow);

  const eyeGlowLeft = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(2.1, 1.55, 0.55),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  eyeGlowLeft.scale.set(0.82, 1.1, 1);
  eyeGlowLeft.position.set(-0.66, 0.08, -0.04);
  faceGroup.add(eyeGlowLeft);

  const eyeGlowRight = eyeGlowLeft.clone();
  eyeGlowRight.position.x = 0.66;
  faceGroup.add(eyeGlowRight);

  const smileGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(2.2, 1.6, 0.62),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  smileGlow.scale.set(1.85, 1.08, 1);
  smileGlow.position.set(0, -0.47, -0.04);
  faceGroup.add(smileGlow);

  const haloRing = new THREE.Group();
  haloRing.position.set(0, 0, -1.05);
  headGroup.add(haloRing);

  const ringA = new THREE.Mesh(
    new THREE.TorusGeometry(1.78, 0.06, 16, 180),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.8, 1.06, 0.4),
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  ringA.rotation.x = Math.PI / 2.9;
  haloRing.add(ringA);

  const ringB = new THREE.Mesh(
    new THREE.TorusGeometry(1.36, 0.03, 16, 160),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.35, 1.58, 0.58),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  ringB.rotation.set(Math.PI / 2.4, 0.42, 0.4);
  haloRing.add(ringB);

  const chestGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(1.1, 0.52, 0.2),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  chestGlow.scale.set(2.8, 2.4, 1);
  chestGlow.position.set(0, 2.1, 0.45);
  root.add(chestGlow);

  return {
    root,
    body,
    belly,
    shoulders,
    head,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLeg,
    rightLeg,
    leftEye,
    rightEye,
    smile,
    faceGlow,
    eyeGlowLeft,
    eyeGlowRight,
    smileGlow,
    ringA,
    ringB,
    chestGlow,
  };
}

function updateCharacter(character, elapsed) {
  const bounce = Math.sin(elapsed * 1.45) * 0.12;
  const squash = Math.sin(elapsed * 1.45 + 0.35) * 0.03;

  character.root.position.y = 1.06 + bounce;
  character.root.rotation.y = Math.sin(elapsed * 0.55) * 0.09;
  character.root.scale.set(1 - squash * 0.22, 1 + squash, 1 - squash * 0.18);

  character.body.rotation.z = Math.sin(elapsed * 0.75) * 0.028;
  character.belly.scale.set(1.1 + squash * 0.1, 0.92 - squash * 0.12, 0.98);
  character.shoulders.scale.y = 0.76 - squash * 0.08;

  character.leftArmPivot.rotation.z = Math.sin(elapsed * 1.3 + 0.25) * 0.1;
  character.leftArmPivot.rotation.x = Math.cos(elapsed * 1.05) * 0.04;
  character.rightArmPivot.rotation.z = -Math.sin(elapsed * 1.3 + 0.55) * 0.1;
  character.rightArmPivot.rotation.x = -Math.cos(elapsed * 1.05 + 0.4) * 0.04;

  character.leftLeg.scale.y = 1 + Math.sin(elapsed * 1.45 + 2.2) * 0.025;
  character.rightLeg.scale.y = 1 + Math.sin(elapsed * 1.45 + 1.3) * 0.025;

  character.headGroup.rotation.z = Math.sin(elapsed * 0.95) * 0.06;
  character.headGroup.rotation.x = Math.cos(elapsed * 0.7) * 0.04;
  character.headGroup.position.y = 4.12 + Math.sin(elapsed * 1.45 + 0.25) * 0.08;
  character.head.scale.set(
    2.65 + Math.sin(elapsed * 1.35) * 0.05,
    2.7 + Math.cos(elapsed * 1.35) * 0.06,
    1.78 + Math.sin(elapsed * 1.35 + 0.3) * 0.04
  );

  updateHeadField(character.head, elapsed);

  const blink = computeBlink(elapsed);
  character.leftEye.scale.y = blink;
  character.rightEye.scale.y = blink;
  character.eyeGlowLeft.scale.y = 1.1 * blink;
  character.eyeGlowRight.scale.y = 1.1 * blink;
  character.smile.scale.set(1 + Math.sin(elapsed * 2.1) * 0.02, 1 + bounce * 0.08, 1);
  character.faceGlow.material.opacity = 0.14 + Math.sin(elapsed * 2.5) * 0.03;
  character.smileGlow.material.opacity = 0.24 + Math.sin(elapsed * 2.2 + 0.4) * 0.04;
  character.ringA.rotation.z = elapsed * 0.42;
  character.ringB.rotation.z = -elapsed * 0.52;
  character.ringB.rotation.y = 0.42 + Math.sin(elapsed * 0.8) * 0.12;
  character.chestGlow.material.opacity = 0.16 + Math.sin(elapsed * 1.8) * 0.04;
}

function updateHeadField(head, elapsed) {
  head.reset();

  const subtract = 12;
  const bodySwell = Math.sin(elapsed * 1.35) * 0.015;
  const tipPulse = Math.sin(elapsed * 1.8 + 0.3) * 0.018;

  const blobs = [
    { x: 0.5, y: 0.49, z: 0.5, strength: 0.93 },
    { x: 0.5, y: 0.7, z: 0.5, strength: 0.58 + tipPulse * 0.4 },
    { x: 0.24 - bodySwell, y: 0.49 + bodySwell, z: 0.5, strength: 0.62 },
    { x: 0.76 + bodySwell, y: 0.49 + bodySwell, z: 0.5, strength: 0.62 },
    { x: 0.36, y: 0.24 - bodySwell, z: 0.5, strength: 0.54 + tipPulse * 0.25 },
    { x: 0.64, y: 0.24 - bodySwell, z: 0.5, strength: 0.54 + tipPulse * 0.25 },
    { x: 0.37, y: 0.6, z: 0.5, strength: 0.35 },
    { x: 0.63, y: 0.6, z: 0.5, strength: 0.35 },
    { x: 0.5, y: 0.55, z: 0.63, strength: 0.24 },
    { x: 0.5, y: 0.55, z: 0.37, strength: 0.24 },
  ];

  for (const blob of blobs) {
    head.addBall(blob.x, blob.y, blob.z, blob.strength, subtract);
  }
}

function createRibbonRig() {
  const group = new THREE.Group();

  const ribbonA = createRibbon(3.2, 2.3, 0.042, new THREE.Color(1.9, 1.1, 0.42), 0);
  group.add(ribbonA);

  const ribbonB = createRibbon(2.55, 1.72, 0.03, new THREE.Color(2.3, 1.6, 0.58), Math.PI / 3);
  ribbonB.rotation.x = 0.65;
  ribbonB.rotation.y = 0.24;
  group.add(ribbonB);

  return { group, ribbonA, ribbonB };
}

function createRibbon(radiusX, radiusZ, thickness, color, offset) {
  const points = [];
  const segments = 160;

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const angle = progress * Math.PI * 2;
    const radiusMod = 1 + Math.sin(angle * 3 + offset) * 0.05;

    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radiusX * radiusMod,
        Math.sin(angle * 2 + offset) * 0.24,
        Math.sin(angle) * radiusZ * (1 + Math.cos(angle * 2 + offset) * 0.04)
      )
    );
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  const geometry = new THREE.TubeGeometry(curve, 260, thickness, 12, true);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  return new THREE.Mesh(geometry, material);
}

function updateRibbonRig(ribbonRig, elapsed) {
  ribbonRig.group.rotation.y = elapsed * 0.18;
  ribbonRig.ribbonA.rotation.z = elapsed * 0.25;
  ribbonRig.ribbonB.rotation.z = -elapsed * 0.32;
}

function createSparkleSwarm(count, config) {
  const group = new THREE.Group();
  const sprites = [];

  for (let index = 0; index < count; index += 1) {
    const material = new THREE.SpriteMaterial({
      map: config.texture,
      color: config.colorChoices[index % config.colorChoices.length],
      transparent: true,
      opacity: randomBetween(config.opacityRange[0], config.opacityRange[1]),
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const sprite = new THREE.Sprite(material);
    const size = randomBetween(config.scaleRange[0], config.scaleRange[1]);
    sprite.scale.set(size, size, 1);
    group.add(sprite);

    sprites.push({
      sprite,
      angle: Math.random() * Math.PI * 2,
      radius: randomBetween(config.radiusRange[0], config.radiusRange[1]),
      depth: randomBetween(config.depthRange[0], config.depthRange[1]),
      baseY: randomBetween(config.heightRange[0], config.heightRange[1]),
      speed: randomBetween(config.speedRange[0], config.speedRange[1]),
      floatAmount: randomBetween(config.verticalRange[0], config.verticalRange[1]),
      phase: Math.random() * Math.PI * 2,
      pulse: randomBetween(1.2, 3.8),
      baseOpacity: material.opacity,
    });
  }

  return { group, sprites };
}

function updateSparkleSwarm(swarm, elapsed, depthScale) {
  swarm.sprites.forEach((item, index) => {
    const spin = item.angle + elapsed * item.speed;
    const radius = item.radius + Math.sin(elapsed * 0.7 + item.phase + index * 0.1) * 0.14;

    item.sprite.position.set(
      Math.cos(spin) * radius,
      item.baseY + Math.sin(elapsed * item.pulse + item.phase) * item.floatAmount,
      Math.sin(spin) * item.depth * depthScale
    );

    item.sprite.material.opacity =
      item.baseOpacity * (0.58 + Math.sin(elapsed * item.pulse + index) * 0.22);
  });
}

function createCompanionStars(texture) {
  const group = new THREE.Group();
  const sprites = [];

  for (let index = 0; index < 6; index += 1) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: index % 2 === 0 ? 0xffefc0 : 0xffbc63,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const sprite = new THREE.Sprite(material);
    const size = randomBetween(0.28, 0.52);
    sprite.scale.set(size, size, 1);
    group.add(sprite);

    sprites.push({
      sprite,
      orbitRadius: 2 + index * 0.32,
      height: 3.2 + (index % 3) * 0.52,
      speed: 0.2 + index * 0.03,
      offset: index * (Math.PI / 3),
      drift: randomBetween(0.08, 0.18),
    });
  }

  return { group, sprites };
}

function updateCompanionStars(companionStars, elapsed) {
  companionStars.sprites.forEach((item, index) => {
    const angle = elapsed * item.speed + item.offset;
    item.sprite.position.set(
      Math.cos(angle) * item.orbitRadius,
      item.height + Math.sin(elapsed * 1.5 + index) * item.drift,
      Math.sin(angle) * (1.6 + index * 0.16)
    );

    const pulse = 0.74 + Math.sin(elapsed * 2.5 + index * 0.9) * 0.2;
    item.sprite.material.opacity = pulse;
  });
}

function computeBlink(elapsed) {
  const blinkA = pulse(elapsed % 5.4, 4.7, 0.08);
  const blinkB = pulse((elapsed + 1.15) % 7.3, 6.5, 0.09);
  return Math.max(0.12, 1 - Math.max(blinkA, blinkB) * 0.92);
}

function pulse(value, center, width) {
  const delta = (value - center) / width;
  return Math.exp(-(delta * delta));
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 10, 128, 128, 118);
  gradient.addColorStop(0, "rgba(255, 248, 221, 1)");
  gradient.addColorStop(0.22, "rgba(255, 223, 145, 0.96)");
  gradient.addColorStop(0.48, "rgba(255, 163, 63, 0.6)");
  gradient.addColorStop(1, "rgba(255, 123, 26, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  const halo = context.createRadialGradient(128, 128, 16, 128, 128, 122);
  halo.addColorStop(0, "rgba(255, 249, 224, 1)");
  halo.addColorStop(0.28, "rgba(255, 214, 113, 0.95)");
  halo.addColorStop(0.6, "rgba(255, 152, 51, 0.32)");
  halo.addColorStop(1, "rgba(255, 152, 51, 0)");
  context.fillStyle = halo;
  context.fillRect(0, 0, 256, 256);

  context.save();
  context.translate(128, 128);
  context.beginPath();

  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * (Math.PI / 5);
    const radius = index % 2 === 0 ? 52 : 22;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.shadowBlur = 24;
  context.shadowColor = "#ffbb55";
  context.fillStyle = "#fff5c7";
  context.fill();
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function randomBetween(min, max) {
  return THREE.MathUtils.randFloat(min, max);
}
