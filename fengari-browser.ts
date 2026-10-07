import { readFile } from "node:fs/promises";
const fix = (code: string) =>
  code
    .split("process.env.FENGARICONF")
    .join("undefined")
    .split("typeof process")
    .join('"undefined"');
export const fengariBrowser = () => ({
  name: "fengari-browser-only",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (/[\\/]fengari[\\/]src[\\/].*\.js/.test(id))
      return { code: fix(code), map: null };
  },
});
export const fengariOptimize = {
  name: "fengari-browser-only",
  setup(build: any) {
    build.onLoad(
      { filter: /[\\/]fengari[\\/]src[\\/].*\.js$/ },
      async (args: any) => ({
        contents: fix(await readFile(args.path, "utf8")),
        loader: "js",
      }),
    );
  },
};
