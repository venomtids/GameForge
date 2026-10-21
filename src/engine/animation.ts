import type { Vec3 } from "./model";

export interface TransformPose {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}
export interface Keyframe extends TransformPose {
  time: number;
}
export interface AnimationClip {
  name: string;
  duration: number;
  loop: boolean;
  autoplay: boolean;
  interpolation: "linear" | "smooth" | "step";
  frames: Keyframe[];
}

/** The format remains v7: animation is an optional, validated extension. */
export function validateAnimation(value: unknown): AnimationClip | null {
  if (value == null) return null;
  const clip = value as AnimationClip;
  const fail = () => {
    throw new Error(
      "Animação inválida. Use 1–120 keyframes e duração de 0,1–120 segundos.",
    );
  };
  if (
    !clip ||
    typeof clip !== "object" ||
    typeof clip.name !== "string" ||
    clip.name.length > 80 ||
    !Number.isFinite(clip.duration) ||
    clip.duration < 0.1 ||
    clip.duration > 120 ||
    typeof clip.loop !== "boolean" ||
    typeof clip.autoplay !== "boolean" ||
    !["linear", "smooth", "step"].includes(clip.interpolation) ||
    !Array.isArray(clip.frames) ||
    clip.frames.length < 1 ||
    clip.frames.length > 120
  )
    fail();
  let last = -1;
  const frames = clip.frames.map((frame) => {
    if (
      !frame ||
      !Number.isFinite(frame.time) ||
      frame.time < 0 ||
      frame.time > clip.duration ||
      frame.time <= last
    )
      fail();
    last = frame.time;
    const pose = {} as TransformPose;
    for (const key of ["position", "rotation", "scale"] as const) {
      const min = key === "scale" ? 0.01 : -10000,
        max = key === "scale" ? 100 : 10000;
      if (
        !Array.isArray(frame[key]) ||
        frame[key].length !== 3 ||
        !frame[key].every((v) => Number.isFinite(v) && v >= min && v <= max)
      )
        fail();
      pose[key] = [...frame[key]] as Vec3;
    }
    return { time: frame.time, ...pose };
  });
  return {
    name: clip.name,
    duration: clip.duration,
    loop: clip.loop,
    autoplay: clip.autoplay,
    interpolation: clip.interpolation,
    frames,
  };
}

/** Pure sampling: no mutation or dependency on the renderer/physics. */
export function sampleAnimation(
  clip: AnimationClip,
  seconds: number,
  loop = clip.loop,
): TransformPose {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const t = loop ? time % clip.duration : Math.min(time, clip.duration);
  const frames = clip.frames;
  let a = frames[0],
    b = a;
  for (const frame of frames) {
    if (frame.time <= t) a = frame;
    if (frame.time >= t) {
      b = frame;
      break;
    }
    b = frame;
  }
  const span = b.time - a.time;
  let factor = span > 0 ? Math.max(0, Math.min(1, (t - a.time) / span)) : 0;
  if (clip.interpolation === "step") factor = 0;
  if (clip.interpolation === "smooth")
    factor = factor * factor * (3 - 2 * factor);
  const pose = {} as TransformPose;
  for (const key of ["position", "rotation", "scale"] as const)
    pose[key] = a[key].map((v, i) => v + (b[key][i] - v) * factor) as Vec3;
  return pose;
}

export function recordKeyframe(
  clip: AnimationClip,
  time: number,
  pose: TransformPose,
): AnimationClip {
  const t =
    Math.round(Math.max(0, Math.min(clip.duration, time)) * 1000) / 1000;
  const frames = clip.frames.filter((f) => Math.abs(f.time - t) > 0.001);
  if (frames.length >= 120)
    throw new Error("Limite de 120 keyframes por objeto.");
  frames.push({
    time: t,
    position: [...pose.position],
    rotation: [...pose.rotation],
    scale: [...pose.scale],
  });
  return { ...clip, frames: frames.sort((a, b) => a.time - b.time) };
}

export function movementClip(pose: TransformPose): AnimationClip {
  const frame = (time: number, y: number): Keyframe => ({
    time,
    position: [pose.position[0], y, pose.position[2]],
    rotation: [...pose.rotation],
    scale: [...pose.scale],
  });
  return {
    name: "Movimento",
    duration: 4,
    loop: true,
    autoplay: true,
    interpolation: "smooth",
    frames: [
      frame(0, pose.position[1]),
      frame(2, pose.position[1] + 2),
      frame(4, pose.position[1]),
    ],
  };
}
