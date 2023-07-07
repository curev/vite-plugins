import fs from "fs";
import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index"],
  clean: true,
  declaration: true,
  failOnWarn: false,
  externals: ["vite"],
  rollup: {
    emitCJS: true,
    dts: {
      respectExternal: false
    }
  },
  hooks: {
    "build:done": function () {
      fs.copyFileSync("client.d.ts", "dist/client.d.ts");
    }
  }
});
