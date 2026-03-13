import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const app = document.querySelector("#app");
const sceneCopy = document.querySelector(".scene-copy");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x140500, 0.052);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 5.9, 13.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 8.5;
controls.maxDistance = 16;
controls.minPolarAngle = 0.95;
controls.maxPolarAngle = 1.7;
controls.target.set(0, 3.2, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;
controls.dampingFactor = 0.06;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(
  new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.15,
    0.72,
    0.18
  )
);

const warmGlowTexture = createGlowTexture();
const starGlowTexture = createStarTexture();

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

const starrBoy = {
  rig: null,
};

if (sceneCopy) {
  sceneCopy.textContent = "Your uploaded StarrBoy model is loading into the scene now.";
}

loadStarrBoyModel()
  .then((rig) => {
    starrBoy.rig = rig;
    scene.add(rig.root);

    if (sceneCopy) {
      sceneCopy.textContent = "Your uploaded StarrBoy model is live, with soft pseudo-rig motion and glowing face details.";
    }
  })
  .catch((error) => {
    console.error("Failed to load StarrBoy model", error);

    if (sceneCopy) {
      sceneCopy.textContent = "The StarrBoy model failed to load. Open the browser console to see the exact error.";
    }
  });

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const elapsed = clock.getElapsedTime();

  if (starrBoy.rig) {
    updateStarrBoyRig(starrBoy.rig, elapsed);
  }

  updateRibbonRig(ribbonRig, elapsed);
  updateSparkleSwarm(orbitSparkles, elapsed, 1);
  updateSparkleSwarm(backgroundSparkles, elapsed, 0.55);
  updateCompanionStars(companionStars, elapsed);
  animateStage(stage, elapsed);

  controls.update();
  composer.render();
});

window.addEventListener("resize", onWindowResize);

function loadStarrBoyModel() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      "./StarrBoy_3d.glb",
      (gltf) => {
        try {
          resolve(buildStarrBoyRig(gltf));
        } catch (error) {
          reject(error);
        }
      },
      undefined,
      reject
    );
  });
}

function buildStarrBoyRig(gltf) {
  const root = new THREE.Group();
  const bobGroup = new THREE.Group();
  const yawGroup = new THREE.Group();
  const scaleGroup = new THREE.Group();

  root.add(bobGroup);
  bobGroup.add(yawGroup);
  yawGroup.add(scaleGroup);

  const model = gltf.scene;
  const primaryMesh = findPrimaryMesh(model);

  if (!primaryMesh) {
    throw new Error("No mesh found inside StarrBoy_3d.glb");
  }

  const baseTextureSource = getTextureSource(primaryMesh.material?.map);
  const textureSample = baseTextureSource ? sampleTextureSource(baseTextureSource) : null;

  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;

    const glowMap = child === primaryMesh && textureSample ? createFeatureGlowMap(textureSample) : null;
    child.material = tuneModelMaterial(child.material, glowMap);
  });

  primaryMesh.geometry.computeBoundingBox();
  const localBounds = primaryMesh.geometry.boundingBox.clone();
  const featureData = textureSample ? analyzeFeatureData(primaryMesh, textureSample) : null;
  const glowMaterials = collectGlowMaterials(model);

  const worldBox = new THREE.Box3().setFromObject(model);
  const center = worldBox.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -worldBox.min.y, -center.z);

  const groundedBox = new THREE.Box3().setFromObject(model);
  const groundedSize = groundedBox.getSize(new THREE.Vector3());
  const scale = 5.25 / Math.max(groundedSize.y, 0.0001);
  scaleGroup.scale.setScalar(scale);
  scaleGroup.add(model);

  const faceAura = createFaceAura(featureData);
  if (faceAura.group) {
    primaryMesh.add(faceAura.group);
  }

  const rigUniforms = applyPseudoRigShader(primaryMesh, localBounds);

  let baseYaw = 0;
  if (featureData && featureData.normal.lengthSq() > 0.0001) {
    const flatNormal = featureData.normal.clone().setY(0);
    if (flatNormal.lengthSq() > 0.0001) {
      flatNormal.normalize();
      baseYaw = -Math.atan2(flatNormal.x, flatNormal.z);
      yawGroup.rotation.y = baseYaw;
    }
  }

  root.position.y = 1.08;

  return {
    root,
    bobGroup,
    yawGroup,
    scaleGroup,
    model,
    primaryMesh,
    rigUniforms,
    faceAura,
    glowMaterials,
    baseYaw,
  };
}

function findPrimaryMesh(root) {
  let bestMesh = null;
  let bestCount = -1;

  root.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    const count = child.geometry?.attributes?.position?.count ?? 0;
    if (count > bestCount) {
      bestMesh = child;
      bestCount = count;
    }
  });

  return bestMesh;
}

function collectGlowMaterials(root) {
  const materials = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    const list = Array.isArray(child.material) ? child.material : [child.material];
    list.forEach((material) => {
      if (material.emissiveMap) {
        materials.push(material);
      }
    });
  });

  return materials;
}

function tuneModelMaterial(material, glowMap) {
  const tuned = material.clone();

  if (tuned.map) {
    tuned.map.colorSpace = THREE.SRGBColorSpace;
    tuned.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  if (glowMap) {
    glowMap.flipY = tuned.map ? tuned.map.flipY : false;
    glowMap.wrapS = tuned.map ? tuned.map.wrapS : THREE.ClampToEdgeWrapping;
    glowMap.wrapT = tuned.map ? tuned.map.wrapT : THREE.ClampToEdgeWrapping;
    glowMap.anisotropy = tuned.map ? tuned.map.anisotropy : 1;

    tuned.emissiveMap = glowMap;
    tuned.emissive = new THREE.Color(0xffefb5);
    tuned.emissiveIntensity = 1.68;
  }

  if (typeof tuned.roughness === "number") {
    tuned.roughness = Math.min(0.84, tuned.roughness);
  }

  if (typeof tuned.metalness === "number") {
    tuned.metalness = 0.02;
  }

  tuned.needsUpdate = true;
  return tuned;
}

function getTextureSource(texture) {
  return texture?.image ?? texture?.source?.data ?? null;
}

function sampleTextureSource(source) {
  const width = source.width ?? source.naturalWidth ?? source.videoWidth;
  const height = source.height ?? source.naturalHeight ?? source.videoHeight;

  if (!width || !height) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, width, height);

  return {
    width,
    height,
    data: context.getImageData(0, 0, width, height).data,
  };
}

function createFeatureGlowMap(sample) {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = sample.width;
  maskCanvas.height = sample.height;

  const maskContext = maskCanvas.getContext("2d");
  const imageData = maskContext.createImageData(sample.width, sample.height);
  const out = imageData.data;

  for (let index = 0; index < sample.data.length; index += 4) {
    const r = sample.data[index];
    const g = sample.data[index + 1];
    const b = sample.data[index + 2];
    const mask = computeFeatureMask(r, g, b);

    out[index] = Math.round(255 * mask);
    out[index + 1] = Math.round(226 * mask);
    out[index + 2] = Math.round(164 * mask);
    out[index + 3] = 255;
  }

  maskContext.putImageData(imageData, 0, 0);

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = sample.width;
  glowCanvas.height = sample.height;

  const glowContext = glowCanvas.getContext("2d");
  glowContext.clearRect(0, 0, sample.width, sample.height);
  glowContext.filter = "blur(7px)";
  glowContext.drawImage(maskCanvas, 0, 0);
  glowContext.filter = "none";
  glowContext.globalCompositeOperation = "screen";
  glowContext.drawImage(maskCanvas, 0, 0);

  const texture = new THREE.CanvasTexture(glowCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function analyzeFeatureData(mesh, sample) {
  const position = mesh.geometry.attributes.position;
  const normal = mesh.geometry.attributes.normal;
  const uv = mesh.geometry.attributes.uv;

  if (!position || !normal || !uv) {
    return null;
  }

  const bounds = mesh.geometry.boundingBox.clone();
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const averagePosition = new THREE.Vector3();
  const averageNormal = new THREE.Vector3();
  const featureBox = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const vertexNormal = new THREE.Vector3();
  let weightSum = 0;

  const step = Math.max(1, Math.floor(position.count / 18000));

  for (let index = 0; index < position.count; index += step) {
    const u = uv.getX(index);
    const v = uv.getY(index);
    const pixelX = THREE.MathUtils.clamp(Math.round(u * (sample.width - 1)), 0, sample.width - 1);
    const pixelY = THREE.MathUtils.clamp(
      Math.round((1 - v) * (sample.height - 1)),
      0,
      sample.height - 1
    );
    const pixelIndex = (pixelY * sample.width + pixelX) * 4;
    const mask = computeFeatureMask(
      sample.data[pixelIndex],
      sample.data[pixelIndex + 1],
      sample.data[pixelIndex + 2]
    );

    if (mask < 0.16) {
      continue;
    }

    vertex.fromBufferAttribute(position, index);
    vertexNormal.fromBufferAttribute(normal, index).normalize();

    averagePosition.addScaledVector(vertex, mask);
    averageNormal.addScaledVector(vertexNormal, mask);
    featureBox.expandByPoint(vertex);
    weightSum += mask;
  }

  if (weightSum < 0.001 || featureBox.isEmpty()) {
    return {
      position: new THREE.Vector3(center.x, center.y + size.y * 0.18, bounds.max.z),
      normal: new THREE.Vector3(0, 0, 1),
      size: new THREE.Vector3(size.x * 0.22, size.y * 0.12, size.z * 0.08),
    };
  }

  averagePosition.divideScalar(weightSum);

  if (averageNormal.lengthSq() < 0.0001) {
    averageNormal.copy(averagePosition).sub(center).setY(0).normalize();
  } else {
    averageNormal.normalize();
  }

  const featureSize = featureBox.getSize(new THREE.Vector3());
  return {
    position: averagePosition,
    normal: averageNormal,
    size: featureSize,
  };
}

function computeFeatureMask(r, g, b) {
  const brightness = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;

  const brightnessMask = smoothstepValue(150, 245, brightness);
  const softnessMask = 1 - smoothstepValue(0.18, 0.5, saturation);
  const creamMask = smoothstepValue(150, 220, g);

  return THREE.MathUtils.clamp(brightnessMask * softnessMask * creamMask, 0, 1);
}

function smoothstepValue(edge0, edge1, value) {
  const normalized = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function createFaceAura(featureData) {
  if (!featureData) {
    return { group: null, soft: null, hot: null };
  }

  const group = new THREE.Group();
  const size = Math.max(featureData.size.x, featureData.size.y * 1.25, 0.08);
  const offset = featureData.normal.clone().multiplyScalar(size * 0.35);
  group.position.copy(featureData.position).add(offset);

  const soft = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: warmGlowTexture,
      color: new THREE.Color(1.55, 0.94, 0.38),
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  soft.scale.set(size * 4.2, size * 3.1, 1);
  group.add(soft);

  const hot = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: warmGlowTexture,
      color: new THREE.Color(2.2, 1.48, 0.56),
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  hot.scale.set(size * 2.15, size * 1.65, 1);
  group.add(hot);

  return { group, soft, hot };
}

function applyPseudoRigShader(mesh, bounds) {
  const material = mesh.material;
  const uniforms = {
    uBoundsMin: { value: bounds.min.clone() },
    uBoundsMax: { value: bounds.max.clone() },
    uHeadPitch: { value: 0 },
    uHeadYaw: { value: 0 },
    uHeadRoll: { value: 0 },
    uLeftArmSwing: { value: 0 },
    uRightArmSwing: { value: 0 },
    uLeftLegSwing: { value: 0 },
    uRightLegSwing: { value: 0 },
    uTorsoPulse: { value: 0 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform float uHeadPitch;
uniform float uHeadYaw;
uniform float uHeadRoll;
uniform float uLeftArmSwing;
uniform float uRightArmSwing;
uniform float uLeftLegSwing;
uniform float uRightLegSwing;
uniform float uTorsoPulse;

mat3 rotationX(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(
    1.0, 0.0, 0.0,
    0.0, c, -s,
    0.0, s, c
  );
}

mat3 rotationY(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(
    c, 0.0, s,
    0.0, 1.0, 0.0,
    -s, 0.0, c
  );
}

mat3 rotationZ(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(
    c, -s, 0.0,
    s, c, 0.0,
    0.0, 0.0, 1.0
  );
}

float bandMask(float startEdge, float endEdge, float value) {
  float ramp = 0.08;
  return smoothstep(startEdge, startEdge + ramp, value) * (1.0 - smoothstep(endEdge - ramp, endEdge, value));
}

vec3 applyPseudoRig(vec3 point) {
  vec3 size = max(uBoundsMax - uBoundsMin, vec3(0.0001));
  vec3 normalized = (point - uBoundsMin) / size;
  vec3 center = (uBoundsMin + uBoundsMax) * 0.5;

  float torsoMask = bandMask(0.22, 0.62, normalized.y) * (1.0 - smoothstep(0.48, 0.95, abs(normalized.x - 0.5) * 2.0));
  vec2 torsoOffset = (point.xz - center.xz) * uTorsoPulse;
  point.x += torsoOffset.x * torsoMask;
  point.z += torsoOffset.y * torsoMask;

  float headCenterMask = 1.0 - smoothstep(0.22, 0.76, abs(normalized.x - 0.5) * 2.0);
  float headMask = smoothstep(0.56, 0.74, normalized.y) * headCenterMask;
  vec3 neckPivot = vec3(center.x, mix(uBoundsMin.y, uBoundsMax.y, 0.56), center.z);
  vec3 headOffset = point - neckPivot;
  headOffset = rotationZ(uHeadRoll) * rotationX(uHeadPitch) * rotationY(uHeadYaw) * headOffset;
  point = mix(point, headOffset + neckPivot, headMask);

  float shoulderBand = bandMask(0.34, 0.68, normalized.y);
  float leftArmMask = shoulderBand * (1.0 - smoothstep(0.24, 0.46, normalized.x));
  float rightArmMask = shoulderBand * smoothstep(0.54, 0.76, normalized.x);
  vec3 leftShoulder = vec3(mix(uBoundsMin.x, uBoundsMax.x, 0.27), mix(uBoundsMin.y, uBoundsMax.y, 0.52), center.z);
  vec3 rightShoulder = vec3(mix(uBoundsMin.x, uBoundsMax.x, 0.73), mix(uBoundsMin.y, uBoundsMax.y, 0.52), center.z);
  vec3 leftArm = rotationZ(uLeftArmSwing) * (point - leftShoulder);
  vec3 rightArm = rotationZ(uRightArmSwing) * (point - rightShoulder);
  point = mix(point, leftArm + leftShoulder, leftArmMask);
  point = mix(point, rightArm + rightShoulder, rightArmMask);

  float lowerMask = 1.0 - smoothstep(0.26, 0.42, normalized.y);
  float leftLegMask = lowerMask * (1.0 - smoothstep(0.38, 0.5, normalized.x));
  float rightLegMask = lowerMask * smoothstep(0.5, 0.62, normalized.x);
  vec3 leftHip = vec3(mix(uBoundsMin.x, uBoundsMax.x, 0.42), mix(uBoundsMin.y, uBoundsMax.y, 0.29), center.z);
  vec3 rightHip = vec3(mix(uBoundsMin.x, uBoundsMax.x, 0.58), mix(uBoundsMin.y, uBoundsMax.y, 0.29), center.z);
  vec3 leftLeg = rotationX(uLeftLegSwing) * (point - leftHip);
  vec3 rightLeg = rotationX(uRightLegSwing) * (point - rightHip);
  point = mix(point, leftLeg + leftHip, leftLegMask);
  point = mix(point, rightLeg + rightHip, rightLegMask);

  return point;
}`
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "vec3 transformed = applyPseudoRig(position);"
    );
  };

  material.customProgramCacheKey = () => "starrboy-pseudo-rig-v1";
  material.needsUpdate = true;

  return uniforms;
}

function updateStarrBoyRig(rig, elapsed) {
  const bounce = Math.sin(elapsed * 1.45) * 0.12;
  const sway = Math.sin(elapsed * 0.7) * 0.06;

  rig.root.position.y = 1.08 + bounce;
  rig.root.rotation.y = Math.sin(elapsed * 0.42) * 0.08;
  rig.bobGroup.rotation.z = Math.sin(elapsed * 0.95) * 0.035;
  rig.yawGroup.rotation.y = rig.baseYaw + sway;

  rig.rigUniforms.uHeadYaw.value = Math.sin(elapsed * 0.82) * 0.18;
  rig.rigUniforms.uHeadPitch.value = Math.cos(elapsed * 1.08) * 0.075;
  rig.rigUniforms.uHeadRoll.value = Math.sin(elapsed * 1.26 + 0.35) * 0.05;
  rig.rigUniforms.uLeftArmSwing.value = Math.sin(elapsed * 1.35 + 0.25) * 0.12;
  rig.rigUniforms.uRightArmSwing.value = -Math.sin(elapsed * 1.35 + 0.72) * 0.12;
  rig.rigUniforms.uLeftLegSwing.value = Math.sin(elapsed * 1.35 + Math.PI) * 0.075;
  rig.rigUniforms.uRightLegSwing.value = Math.sin(elapsed * 1.35) * 0.075;
  rig.rigUniforms.uTorsoPulse.value = Math.sin(elapsed * 1.45 + 0.1) * 0.018;

  rig.glowMaterials.forEach((material, index) => {
    material.emissiveIntensity = 1.58 + Math.sin(elapsed * 2.05 + index * 0.3) * 0.18;
  });

  if (rig.faceAura.soft) {
    rig.faceAura.soft.material.opacity = 0.17 + Math.sin(elapsed * 2.3) * 0.03;
  }

  if (rig.faceAura.hot) {
    rig.faceAura.hot.material.opacity = 0.22 + Math.sin(elapsed * 2.7 + 0.4) * 0.04;
    const pulse = 1 + Math.sin(elapsed * 2.2) * 0.05;
    rig.faceAura.hot.scale.set(pulse, pulse, 1);
  }
}

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

