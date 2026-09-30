import luaparse from "luaparse";
import { parse as parseJS } from "acorn";
import type { ScriptLanguage } from "./model";
export interface CodeIssue {
  line: number;
  column: number;
  message: string;
  from: number;
  to: number;
  severity: "error" | "warning";
}
export function diagnose(
  source: string,
  language: ScriptLanguage,
): CodeIssue[] {
  if (language === "none") return [];
  try {
    if (language === "lua")
      luaparse.parse(source, {
        luaVersion: "5.3",
        locations: true,
        encodingMode: "none",
      });
    else
      parseJS(source, {
        ecmaVersion: 2022,
        locations: true,
        sourceType: "script",
      });
    return [];
  } catch (error) {
    const e = error as {
      message: string;
      line?: number;
      column?: number;
      index?: number;
      pos?: number;
      loc?: { line: number; column: number };
    };
    const line = e.loc?.line ?? e.line ?? 1,
      column = (e.loc?.column ?? e.column ?? 0) + 1;
    const offset =
      source
        .split("\n")
        .slice(0, line - 1)
        .reduce((n, s) => n + s.length + 1, 0) +
      column -
      1;
    const from = Math.min(
      source.length,
      Math.max(0, e.pos ?? e.index ?? offset),
    );
    return [
      {
        line,
        column,
        message: e.message,
        from,
        to: Math.min(source.length, from + 1),
        severity: "error",
      },
    ];
  }
}
