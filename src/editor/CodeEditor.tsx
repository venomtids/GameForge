import { useEffect, useRef } from "react";
import { Annotation, EditorState } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  drawSelection,
} from "@codemirror/view";
import {
  StreamLanguage,
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
  indentOnInput,
} from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { javascript } from "@codemirror/lang-javascript";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { lintGutter, linter } from "@codemirror/lint";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import { diagnose } from "../engine/diagnostics";
import type { ScriptLanguage } from "../engine/model";
const externalChange = Annotation.define<boolean>();
const colors = HighlightStyle.define([
  { tag: tags.keyword, color: "#c7a0f8" },
  { tag: tags.string, color: "#c4db91" },
  { tag: tags.number, color: "#edb98b" },
  { tag: tags.comment, color: "#849c98", fontStyle: "italic" },
  { tag: tags.function(tags.variableName), color: "#81cbea" },
  { tag: tags.operator, color: "#f19aab" },
  { tag: tags.bool, color: "#edb98b" },
  { tag: tags.variableName, color: "#d9e6e3" },
]);
const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#101a20",
      color: "#d9e6e3",
      fontSize: "13px",
    },
    ".cm-scroller": { overflow: "auto", fontFamily: "Consolas, monospace" },
    ".cm-content": { caretColor: "#93e6c7", minHeight: "180px" },
    ".cm-gutters": {
      backgroundColor: "#162229",
      color: "#6f898c",
      borderRight: "1px solid #304148",
    },
    ".cm-activeLine,.cm-activeLineGutter": { backgroundColor: "#203139" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "#37564e!important",
    },
    ".cm-cursor": { borderLeftColor: "#a7ebcf" },
    ".cm-tooltip": {
      backgroundColor: "#22323a",
      border: "1px solid #53686d",
      color: "#e0eeeb",
    },
    ".cm-search": { color: "#d9e6e3" },
  },
  { dark: true },
);
const words = [
  "self.id",
  "self.health",
  "engine.light",
  "engine.flicker",
  "engine.torch",
  "engine.sound",
  "engine.loop",
  "engine.volume",
  "engine.move",
  "engine.walk",
  "engine.rotate",
  "engine.stop",
  "engine.bot",
  "engine.damage",
  "engine.heal",
  "engine.ragdoll",
  "engine.impulse",
  "self.x",
  "self.y",
  "self.z",
  "self.rx",
  "self.ry",
  "self.rz",
  "self.vx",
  "self.vy",
  "self.vz",
  "self.grounded",
  "self.color",
  "self.visible",
  "engine.log",
  "engine.get",
  "engine.set",
  "engine.spawn",
  "engine.remove",
  "engine.ui",
  "engine.voxel.get",
  "engine.voxel.set",
  "engine.voxel.replace",
  "engine.voxel.snapshot",
  "engine.store",
  "engine.saved",
  "input.ray",
  "input.target",
  "input.events",
  "engine.clamp",
  "engine.lerp",
  "engine.distance",
  "input.w",
  "input.space",
  "input.pressed.space",
  "input.released.space",
  "math.sin",
  "math.cos",
];
export default function CodeEditor({
  source,
  language,
  disabled,
  onChange,
}: {
  source: string;
  language: ScriptLanguage;
  disabled: boolean;
  onChange: (s: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null),
    callback = useRef(onChange);
  callback.current = onChange;
  const initial = useRef(source);
  initial.current = source;
  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          lintGutter(),
          highlightSelectionMatches(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
          language === "lua" ? StreamLanguage.define(lua) : javascript(),
          syntaxHighlighting(colors),
          theme,
          EditorState.readOnly.of(disabled),
          EditorView.editable.of(!disabled),
          EditorView.contentAttributes.of({
            "aria-label": "Código do script",
            role: "textbox",
            "aria-multiline": "true",
          }),
          autocompletion({
            override: [
              (ctx) => {
                const word = ctx.matchBefore(/[\w.]+/);
                if (!word && !ctx.explicit) return null;
                return {
                  from: word?.from ?? ctx.pos,
                  options: words.map((label) => ({ label, type: "property" })),
                };
              },
            ],
          }),
          linter(
            (v) =>
              diagnose(v.state.doc.toString(), language).map((d) => ({
                from: d.from,
                to: d.to,
                severity: d.severity,
                message: `Linha ${d.line}: ${d.message}`,
              })),
            { delay: 250 },
          ),
          EditorState.transactionFilter.of((tr) =>
            tr.newDoc.length > 128000 ? [] : tr,
          ),
          EditorView.updateListener.of((u) => {
            if (
              u.docChanged &&
              !u.transactions.some((transaction) =>
                transaction.annotation(externalChange),
              )
            )
              callback.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, [language, disabled]);
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== source)
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: source },
        annotations: externalChange.of(true),
      });
  }, [source]);
  return <div className="code-editor" ref={host} />;
}
