import path from "path/posix";
import { promisify } from "util";
import type { Plugin } from "vite";
import { normalizePath } from "vite";
import fs from "fs-extra";
import Spritesmith from "spritesmith";
import { createHash, createSingletonPromise, isMatch, mapTemplate } from "./utils";

interface SourceOptions {
  name?: string
  source: string
  excludes?: string[]
  includes?: string[]

  /**
   * @default "curev-sprite-[name]"
   * @param entry
   */
  className?: ((entry: { name: string; filename: string; source: string; dirname: string }) => string) | string

  /**
   * @default "[name]_[hash].png"
   * @param entry
   * @returns
   */
  filename?: ((entry: { name: string; source: string; hash: string }) => string) | string
}

export interface Sprite2CssPluginOptions {
  /**
   * 图片源
   */
  entries: SourceOptions[] | SourceOptions
  /**
   * 是否开启热更新
   */
  hmr?: boolean

  /**
   * 生成的图片路径,相对于dist文件夹
   */
  target?: string
  /*
   * 生成的图片小于此值时，转换为base64
   */
  threshold?: number

  /**
   * @default 8
   */
  hashLength?: number
}

function isModuleId(id: string) {
  if (id.startsWith("virtual:")) {
    id.slice(8);
  }
  if (id.startsWith("/")) {
    id.slice(1);
  }
  return id === "@curev/sprite.css";
}

export function createSprite2CssPlugin(options: Sprite2CssPluginOptions): Plugin {
  const hmr = options.hmr ?? true;

  const entries = Array.isArray(options.entries) ? options.entries : [options.entries];
  const sources = entries.map(entry => normalizePath(entry.source));

  // 生成的css代码
  const codes: string[] = [];

  // 缓存图片数据
  const cacheMap = new Map<string, Buffer>();

  const target = options.target ?? "/assets/images/sprite2css/";

  const threshold = options.threshold ?? 0;

  const hashLength = options.hashLength ?? 8;

  let _base = "/";

  // 加载图片
  const load = createSingletonPromise(async () => {
    const tasks: Promise<void>[] = [];

    for (const entry of entries) {
      const _className = entry.className ?? "curev-sprite-[name]";
      const _filename = entry.filename ?? "[name]_[hash].png";
      const imgs: string[] = [];
      const source = normalizePath(entry.source);
      const includes = entry.includes ?? [];
      const excludes = entry.excludes ?? [];
      const entryName = entry.name ?? path.basename(source);

      function loadDir(f: string) {
        const files = fs.readdirSync(f);
        for (const file of files) {
          if (excludes?.length && isMatch(file, ...excludes)) {
            continue;
          }
          if (includes?.length && !isMatch(file, ...includes)) {
            continue;
          }
          const filePath = path.join(f, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            loadDir(filePath);
          } else {
            imgs.push(filePath);
          }
        }
      }

      if (!fs.statSync(source).isDirectory()) {
        console.warn("source is not a directory");
        continue;
      }
      loadDir(source);

      tasks.push(
        (async () => {
          const { coordinates, image } = await promisify(Spritesmith.run)({ src: imgs });

          let filePath: string;

          if (image.length < threshold) {
            // 转换为base64
            filePath = `data:image/png;base64,${image.toString("base64")}`;
          } else {
            const arg = {
              name: entryName,
              hash: createHash(image, hashLength),
              source
            };
            const filename = typeof _filename == "function" ? _filename(arg) : mapTemplate(_filename, arg);
            filePath = path.join(target, filename);
            cacheMap.set(filePath, image);
          }

          for (const filename in coordinates) {
            const { x, y, width, height } = coordinates[filename];
            const dirname = path.dirname(filename).replace(source, "").replace(/\\/g, "/");
            const name = path.basename(filename, path.extname(filename));

            const entry = {
              name,
              filename,
              source,
              dirname
            };

            let className = typeof _className == "function" ? _className(entry) : mapTemplate(_className, entry);

            className = className
              .split(/[\/\-\\]/g)
              .filter(e => !!e)
              .join("-");

            codes.push(`.${className}{background-position: -${x}px -${y}px;width: ${width}px;height: ${height}px;background-image: url(${path.join(_base, filePath)})}`);
          }
        })()
      );
    }

    await Promise.all(tasks);
  });

  function reset() {
    codes.length = 0;
    cacheMap.clear();
    load.reset();
  }

  let isBuild = false;

  return {
    name: "vite-plugin-sprite2css",
    config(config, env) {
      isBuild = env.command === "build";
    },
    configResolved(config) {
      _base = config.base;
    },
    async buildStart() {
      await load();
      // 如果是build模式，需要将图片输出到dist目录
      if (isBuild) {
        for (const [name, img] of cacheMap) {
          this.emitFile({
            type: "asset",
            fileName: name.replace(/^\//, ""),
            source: img
          });
        }
      }
    },
    resolveId(id) {
      if (isModuleId(id)) {
        return id;
      }
      if (id.startsWith(target)) {
        return id;
      }
    },
    async load(id) {
      if (isModuleId(id)) {
        await load();
        return codes.join("\n");
      }
    },
    configureServer(server) {
      if (hmr) {
        server.watcher.add(sources);
        server.watcher.on("all", (event, file) => {
          file = normalizePath(file);
          if (sources.some(source => file.startsWith(source))) {
            reset();
          }
        });
      }
      server.middlewares.use(async (req, res, next) => {
        await load();
        if (req.url?.startsWith(path.join(_base, target))) {
          const img = cacheMap.get(req.url.replace(_base, "/"));
          if (img) {
            res.setHeader("Content-Type", "image/png");
            res.end(img);
            return;
          }
        }
        next();
      });
    }
  };
}
