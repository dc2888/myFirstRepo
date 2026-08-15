const STEP_DISTANCE = 5;
const BODY_LEAN = 2.8;
const SHADOW_STRETCH = 0.07;

export function createWalkPose({ dx, dy, walkTime, moving }) {
  if (!moving) {
    return {
      leftFoot: { x: 0, y: 0 },
      rightFoot: { x: 0, y: 0 },
      bodyOffsetY: 0,
      bodyAngle: 0,
      shadowScaleX: 1,
      shadowScaleY: 1,
      shadowAlpha: 0.28,
    };
  }

  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const direction = horizontal ? Math.sign(dx) || 1 : Math.sign(dy) || 1;
  const step = Math.sin(walkTime) * STEP_DISTANCE * direction;
  const counterStep = -step;
  const bodyAngle = horizontal ? Math.sign(dx) * BODY_LEAN : Math.sin(walkTime) * BODY_LEAN * 0.35;
  const strideAmount = Math.abs(Math.sin(walkTime));

  return {
    leftFoot: horizontal ? { x: step, y: 0 } : { x: 0, y: step },
    rightFoot: horizontal ? { x: counterStep, y: 0 } : { x: 0, y: counterStep },
    bodyOffsetY: 0,
    bodyAngle,
    shadowScaleX: 1 + strideAmount * SHADOW_STRETCH,
    shadowScaleY: 1 - strideAmount * SHADOW_STRETCH * 0.6,
    shadowAlpha: 0.26 + strideAmount * 0.04,
  };
}
