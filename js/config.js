export const CONFIG = {
  boidCount: 50,

  bounds: {
    x: [-20, 20],
    y: [-20, 20],
    z: [-20, 20],
  },

  boid: {
    cruiseSpeed: 10, // u/s
    maxSpeed: 20, // u/s
    maxAcceleration: 10, // u/s²

    // Distance under which separation starts acting.
    personalSpaceRadius: 3,

    perceptionRadius: 8,
    perceptionAngle: 120, // degrees

    // Time used to convert velocity error into steering acceleration.
    steeringResponseTime: 2, // s

    separationStrength: 1,
    alignmentStrength: 1,
    cohesionStrength: 0.35,

    // Controls how sharply separation increases at close range.
    separationFalloffExponent: 2,
  },

  boundsAvoidance: {
    // Distance from the bounds where avoidance starts acting.
    margin: 5,
    strength: 1,

    // Controls how sharply avoidance increases near and beyond the bounds.
    falloffExponent: 2,
  },

  fish: {
    url: "./assets/fish.glb",
    targetSize: 7,

    // Local model axis that should point along the boid's velocity.
    forwardAxis: { x: -1, y: 0, z: 0 },
  },

  mouseInteraction: {
    visualRadiusPx: 25,
    effectRadiusPx: 110, // px
    strength: 3,

    // Controls how quickly the interaction weakens toward the effect radius.
    falloffExponent: 2,
  },

  camera: {
    fov: 70, // degrees
    z: 50,
  },

  background: 0x10141c,
};