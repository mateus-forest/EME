const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const root = path.resolve(__dirname, "../..")
function loader(overrides = {}) {
  const cache = new Map()
  function load(file) {
    const full = path.resolve(root, file)
    if (cache.has(full)) return cache.get(full)
    const exports = {}
    cache.set(full, exports)
    const code = ts.transpileModule(fs.readFileSync(full, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText
    new Function("require", "exports", code)((name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name]
      if (name === "server-only") return {}
      if (name.startsWith("@/")) return load(name.slice(2) + ".ts")
      if (name.startsWith("."))
        return load(
          path.relative(root, path.resolve(path.dirname(full), name)) + ".ts",
        )
      return require(name)
    }, exports)
    return exports
  }
  return load
}
module.exports = { loader }
