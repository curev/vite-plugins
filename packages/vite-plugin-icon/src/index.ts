import fs from "fs";
import type { Plugin } from "vite";

export interface IconComponentOptions {
  /**
   * @default "?icon"
   */
  suffix?: string
}

export interface IconComponentProps {
  tag?: string
  size?: string | number
  width?: string | number
  height?: string | number
  color?: string
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

        export function createIconComponent(url){
         return (props)=>{
            const tag = props.tag ?? "i";
            const propSize = props.size ?? "16px";
            const size = typeof propSize === "number" ? propSize + "px" : propSize;
            const propWidth = props.width ?? size;
            const width = typeof propWidth === "number" ? propWidth + "px" : propWidth;
            const propHeight = props.height ?? size;
            const height = typeof propHeight === "number" ? propHeight + "px" : propHeight;
            const color = props.color ?? "currentColor";

            return h(tag, {
              style: {
                "--svg-icon": url,
                "mask": "var(--svg-icon) no-repeat",
                "mask-size": "100% 100%",
                "-webkit-mask": "var(--svg-icon) no-repeat",
                "-webkit-mask-size": "100% 100%",
                "background-color": color,
                "display": "inline-block",
                "width": width,
                "height": height,
              }
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
      const svgCode = await fs.promises.readFile(svg.id.replace(suffix, ""), { encoding: "utf-8" });
      const svgCodeMin = svgCode.replace(/\s+/g, " ").trim();
      const url = `url('data:image/svg+xml,${encodeURIComponent(svgCodeMin)}')`;
      return `
        import {createIconComponent} from "@curev/icon-component";
        export default createIconComponent("${url}");
      `;
    }
  };
}
