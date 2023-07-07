import fs from "fs";
import type { Plugin } from "vite";

export interface IconComponentOptions {
  /**
   * @default "?icon"
   */
  suffix?: string
}

export function createIconComponentPlugin(options: IconComponentOptions = {}): Plugin {
  const suffix = options.suffix ?? "?icon";
  return {
    name: "vite-plugin-icon-component",
    resolveId(id) {
      if (id === "@curev/icon-component") {
        return id;
      }
    },
    load(id) {
      if (id === "@curev/icon-component") {
        return `
        import { h } from "vue";

        export function createIconComponent(url,extendsProps={}){
         return (props = {})=>{
            props = {...extendsProps,...props};
            const tag = props.tag ?? "i";
            const propSize = props.size ?? "16px";
            const size = typeof propSize === "number" ? propSize + "px" : propSize;
            const propWidth = props.width ?? size;
            const width = typeof propWidth === "number" ? propWidth + "px" : propWidth;
            const propHeight = props.height ?? size;
            const height = typeof propHeight === "number" ? propHeight + "px" : propHeight;
            const color = props.color ?? "currentColor";
            const mask = props.mask ?? url.endsWith(".svg");

            if(!mask){
              return h(tag, {
                style: {
                  "--icon-url": "url('"+url+"')",
                  "background-image":"var(--icon-url)",
                  "height": height,
                  "width": width,
                  "display": "inline-block",
                  ...(props.style ?? {}),
                },
                class: props.class,
              });
            }

            return h(tag, {
              style: {
                "--icon-url": "url('"+url+"')",
                "mask": "var(--icon-url) no-repeat",
                "mask-size": "100% 100%",
                "-webkit-mask": "var(--icon-url) no-repeat",
                "-webkit-mask-size": "100% 100%",
                "background-color": color,
                "display": "inline-block",
                "width": width,
                "height": height,
                ...(props.style ?? {}),
              },
              class: props.class,
            });
          }
        }`;
      }
    },
    async transform(code, id) {
      if (!id.endsWith(suffix)) {
        return;
      }
      const svg = await this.resolve(id);
      if (!svg) {
        return;
      }
      const filename = svg.id.replace(suffix, "");
      const isSvg = filename.endsWith(".svg");
      let url: string;
      if (isSvg) {
        const svgCode = await fs.promises.readFile(svg.id.replace(suffix, ""), { encoding: "utf-8" });
        const svgCodeMin = svgCode.replace(/\s+/g, " ").trim();
        url = `data:image/svg+xml,${encodeURIComponent(svgCodeMin)}`;
      } else {
        url = filename;
      }
      return `
        import {createIconComponent} from "@curev/icon-component";
        export default createIconComponent("${url}",{
          mask: ${isSvg}
        });
      `;
    }
  };
}
