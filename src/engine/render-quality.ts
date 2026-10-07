export type QualityMode = "auto" | "economy" | "high";
/** Slow hysteresis avoids resizing GPU buffers on every frame. This is a pixel budget, not an FPS guarantee. */
export class AdaptiveResolution {
  ratio = 1;
  private healthy = 0;
  constructor(private deviceRatio = 1) {
    this.ratio = Math.min(deviceRatio, 1.5);
  }
  setMode(mode: QualityMode) {
    if (mode === "economy") this.ratio = Math.min(this.deviceRatio, 0.85);
    if (mode === "high") this.ratio = Math.min(this.deviceRatio, 2);
    if (mode === "auto")
      this.ratio = Math.max(0.65, Math.min(this.ratio, this.deviceRatio, 1.5));
    this.healthy = 0;
    return this.ratio;
  }
  sample(fps: number, mode: QualityMode) {
    if (mode !== "auto" || !Number.isFinite(fps) || fps <= 0) return this.ratio;
    if (fps < 38) {
      this.healthy = 0;
      this.ratio = Math.max(0.65, Math.round((this.ratio - 0.15) * 100) / 100);
    } else if (fps > 56) {
      if (++this.healthy >= 6) {
        this.ratio = Math.min(
          this.deviceRatio,
          1.5,
          Math.round((this.ratio + 0.1) * 100) / 100,
        );
        this.healthy = 0;
      }
    } else this.healthy = 0;
    return this.ratio;
  }
}
