import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export class Boid {
  constructor(scene, fishTemplate, config) {
    this.config = config;
    this.mesh = SkeletonUtils.clone(fishTemplate);

    // Local mesh axis used to orient the model along its velocity.
    this.forwardAxis = new THREE.Vector3(
      config.fish.forwardAxis.x,
      config.fish.forwardAxis.y,
      config.fish.forwardAxis.z,
    ).normalize();

    this.velocity = this.randomDirection().multiplyScalar(config.boid.cruiseSpeed);
    this.acceleration = new THREE.Vector3();

    const { x, y, z } = config.bounds;
    this.mesh.position.set(
      THREE.MathUtils.randFloat(x[0], x[1]),
      THREE.MathUtils.randFloat(y[0], y[1]),
      THREE.MathUtils.randFloat(z[0], z[1]),
    );

    scene.add(this.mesh);
  }

  randomDirection() {
    const direction = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    );

    return direction.lengthSq() === 0
      ? new THREE.Vector3(1, 0, 0)
      : direction.normalize();
  }


  // PERCEPTION AND FLOCKING

  isInPerceptionCone(difference, distance) {
    const { perceptionRadius, perceptionAngle } = this.config.boid;
    if (distance <= 0 || distance > perceptionRadius || this.velocity.lengthSq() === 0) {
      return false;
    }

    // Half the configured angle defines the cone threshold around the forward direction.
    const minimumDot = Math.cos(
      THREE.MathUtils.degToRad(perceptionAngle / 2),
    );

    return this.velocity.clone().normalize().dot(
      difference.clone().normalize(),
    ) >= minimumDot;
  }

  calculateAcceleration(boids, mouseInteraction) {
    this.acceleration.set(0, 0, 0);
    const neighbors = [];
    const personalSpaceRadius = this.config.boid.personalSpaceRadius;

    for (const other of boids) {
      if (other === this) continue;

      const difference = other.mesh.position.clone().sub(this.mesh.position);
      const distance = difference.length();

      if (this.isInPerceptionCone(difference, distance)) {
        neighbors.push(other);
      }

      // Separation stays omnidirectional to avoid collisions outside the perception cone.
      if (distance > 0 && distance < personalSpaceRadius) {
        this.applySeparation(difference, distance);
      }
    }

    this.applyAlignment(neighbors);
    this.applyCohesion(neighbors);
    this.applyMouseInteraction(mouseInteraction);
    this.applyBoundsAvoidance();

    // Caps the combined contribution of all steering behaviours.
    this.acceleration.clampLength(0, this.config.boid.maxAcceleration);
  }

  applySeparation(difference, distance) {
    const {
      personalSpaceRadius,
      maxAcceleration,
      separationStrength,
      separationFalloffExponent,
    } = this.config.boid;

    // Separation increases nonlinearly as another boid gets closer.
    const ratio = 1 - distance / personalSpaceRadius;
    const strength =
      maxAcceleration * separationStrength * ratio ** separationFalloffExponent;

    this.acceleration.add(
      difference.clone().normalize().negate().multiplyScalar(strength),
    );
  }

  applyAlignment(neighbors) {
    if (neighbors.length === 0) return;

    const averageVelocity = neighbors.reduce(
      (sum, neighbor) => sum.add(neighbor.velocity),
      new THREE.Vector3(),
    ).divideScalar(neighbors.length);

    if (averageVelocity.lengthSq() === 0) return;

    // Desired velocity follows the neighbours' average direction at cruise speed.
    this.steerToward(
      averageVelocity.normalize().multiplyScalar(this.config.boid.cruiseSpeed),
      this.config.boid.alignmentStrength,
    );
  }

  applyCohesion(neighbors) {
    if (neighbors.length === 0) return;

    const center = neighbors.reduce(
      (sum, neighbor) => sum.add(neighbor.mesh.position),
      new THREE.Vector3(),
    ).divideScalar(neighbors.length);

    const direction = center.sub(this.mesh.position);
    if (direction.lengthSq() === 0) return;

    // Desired velocity points toward the neighbours' center at cruise speed.
    this.steerToward(
      direction.normalize().multiplyScalar(this.config.boid.cruiseSpeed),
      this.config.boid.cohesionStrength,
    );
  }

  steerToward(desiredVelocity, strength) {
    const responseTime = this.config.boid.steeringResponseTime;

    // Converts the velocity error into acceleration over the configured response time.
    this.acceleration.add(
      desiredVelocity
        .sub(this.velocity)
        .divideScalar(responseTime)
        .multiplyScalar(strength),
    );
  }


  // MOUSE INTERACTION

  applyMouseInteraction(mouseInteraction) {
    if (!mouseInteraction || mouseInteraction.mode === null) return;

    const {
      ray,
      mouse,
      mode,
      camera,
      viewportWidth,
      viewportHeight,
    } = mouseInteraction;
    const { effectRadiusPx, strength, falloffExponent } = this.config.mouseInteraction;

    const worldPosition = this.mesh.getWorldPosition(new THREE.Vector3());
    const projected = worldPosition.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return;

    // Projection to pixels keeps the interaction radius independent from world depth.
    const screenPosition = new THREE.Vector2(
      ((projected.x + 1) / 2) * viewportWidth,
      ((1 - projected.y) / 2) * viewportHeight,
    );
    const screenDistance = screenPosition.distanceTo(mouse);
    if (screenDistance >= effectRadiusPx) return;

    // The cursor ray provides a 3D force direction while distance is measured on screen.
    const closestPoint = ray.closestPointToPoint(
      worldPosition,
      new THREE.Vector3(),
    );
    const direction = worldPosition.clone().sub(closestPoint);
    if (direction.lengthSq() === 0) return;

    direction.normalize();
    if (mode === "attract") direction.negate();

    const ratio = 1 - screenDistance / effectRadiusPx;
    const force =
      this.config.boid.maxAcceleration *
      strength *
      ratio ** falloffExponent;

    this.acceleration.add(direction.multiplyScalar(force));
  }


  // BOUNDS AVOIDANCE

  applyBoundsAvoidance() {
    const { bounds, boundsAvoidance, boid } = this.config;

    for (const axis of ["x", "y", "z"]) {
      const [min, max] = bounds[axis];
      const position = this.mesh.position[axis];
      let ratio = 0;
      let direction = 0;

      // The ratio reaches 1 at the boundary and continues increasing outside the bounds.
      if (position < min + boundsAvoidance.margin) {
        ratio = (min + boundsAvoidance.margin - position) / boundsAvoidance.margin;
        direction = 1;
      } else if (position > max - boundsAvoidance.margin) {
        ratio = (position - (max - boundsAvoidance.margin)) / boundsAvoidance.margin;
        direction = -1;
      }

      if (direction !== 0) {
        this.acceleration[axis] +=
          direction *
          boid.maxAcceleration *
          boundsAvoidance.strength *
          ratio ** boundsAvoidance.falloffExponent;
      }
    }
  }


  // INTEGRATION

  update(dt) {
    const maxSpeed = this.config.boid.maxSpeed;

    this.velocity.addScaledVector(this.acceleration, dt).clampLength(0, maxSpeed);
    this.mesh.position.addScaledVector(this.velocity, dt);

    if (this.velocity.lengthSq() > 0) {
      // Aligns the model's configured forward axis with its current velocity.
      this.mesh.quaternion.setFromUnitVectors(
        this.forwardAxis,
        this.velocity.clone().normalize(),
      );
    }
  }
}