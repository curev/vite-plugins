

declare module "@curev/icon-component" {

  export interface IconComponentProps {
    tag?: string;
    size?: string | number;
    width?: string | number;
    height?: string | number;
    color?: string;
    mask?: boolean;
    class?: string | string[] | Record<string, unknown>;
    style?: Record<string, unknown>;
    icon?: string | IconComponentType;
  }

  export const IconComponent: {
    new (): {
      $props: IconComponentProps & {};
    };
  };


  export type IconComponentType = typeof IconComponent;

  export function createIconComponent(props: IconComponentProps): IconComponentType;
}
