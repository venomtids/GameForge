import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUp, CornerDownLeft, Search, X } from "lucide-react";
import { useDialog } from "./useDialog";
export interface StudioCommand {
  id: string;
  title: string;
  group: string;
  shortcut?: string;
  icon: ReactNode;
  disabled?: boolean;
  run: () => void;
}
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function CommandPalette({
  commands,
  onClose,
}: {
  commands: StudioCommand[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const ref = useDialog(true, onClose);
  const results = useMemo(
    () =>
      commands.filter((c) =>
        normalize(c.title + " " + c.group).includes(normalize(query)),
      ),
    [commands, query],
  );
  useEffect(() => {
    setActive(0);
  }, [query]);
  useEffect(() => {
    ref.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, ref]);
  const run = (command?: StudioCommand) => {
    if (command && !command.disabled) {
      onClose();
      command.run();
    }
  };
  return (
    <div
      className="modal-backdrop command-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Busca de comandos"
        tabIndex={-1}
      >
        <div className="command-search">
          <Search size={20} />
          <input
            data-autofocus
            placeholder="O que você quer criar?"
            aria-label="Buscar comando"
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="studio-commands"
            aria-autocomplete="list"
            aria-activedescendant={
              results[active] ? `command-${results[active].id}` : undefined
            }
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) =>
                  results.length
                    ? (i + (e.key === "ArrowDown" ? 1 : results.length - 1)) %
                      results.length
                    : 0,
                );
              }
              if (e.key === "Enter") {
                e.preventDefault();
                run(results[active]);
              }
            }}
          />
          <button onClick={onClose} aria-label="Fechar comandos">
            <X size={18} />
          </button>
        </div>
        <div
          className="command-results"
          id="studio-commands"
          role="listbox"
          aria-label="Comandos do Studio"
        >
          {!results.length && (
            <div className="command-empty">
              <Search size={26} />
              <strong>Nenhum comando encontrado</strong>
              <span>Tente “terreno”, “salvar” ou “animação”.</span>
            </div>
          )}
          {results.map((c, i) => (
            <div
              key={c.id}
              id={`command-${c.id}`}
              data-index={i}
              role="option"
              aria-selected={active === i}
              aria-disabled={c.disabled}
              className={`command-result ${active === i ? "active" : ""} ${c.disabled ? "disabled" : ""}`}
              onPointerMove={() => setActive(i)}
              onClick={() => run(c)}
            >
              <span className="command-icon">{c.icon}</span>
              <span>
                <strong>{c.title}</strong>
                <small>{c.group}</small>
              </span>
              {c.shortcut && <kbd>{c.shortcut}</kbd>}
              {active === i && <CornerDownLeft size={14} />}
            </div>
          ))}
        </div>
        <footer>
          <span>
            <ArrowUp size={12} /> ↑ ↓ navegar
          </span>
          <span>
            <CornerDownLeft size={12} /> Enter executar
          </span>
          <span>
            <kbd>Esc</kbd> fechar
          </span>
          <strong>GAMEFORGE STUDIO</strong>
        </footer>
      </div>
    </div>
  );
}
