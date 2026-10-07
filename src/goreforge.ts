import "./goreforge/goreforge.css";
import { GameRuntime } from "./goreforge/runtime/GameRuntime";

/**
 * Entrada do GORE FORGE.
 *
 * O jogo é um exemplo COMPLETO de projeto feito com a engine atual: física de
 * gelatina, contatos de malha deformada, ragdoll/desmembramento, armas com
 * recuo, saturação de corpos dinâmicos (Cannon-es), decalques, partículas e uma
 * UI 100% dirigida por dados.
 *
 * Abrir em `/goreforge.html`. O runtime fica exposto em `window.goreforge` para
 * console, testes de navegador e automação.
 */

declare global {
  interface Window {
    goreforge?: GameRuntime;
  }
}

const boot = document.getElementById("goreforge-boot");
const runtime = new GameRuntime({ container: document.body, seed: 20261006 });
window.goreforge = runtime;
runtime.start();

const enter = () => {
  boot?.classList.add("gf-hidden");
  window.setTimeout(() => boot?.remove(), 360);
  void runtime.rig.capture();
  runtime.ctx.world.audio.play("ui.confirmar", 0.5, 1);
};

document.getElementById("gf-enter")?.addEventListener("click", enter);
window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && boot) enter();
});
