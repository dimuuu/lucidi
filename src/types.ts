import { EventHandler } from "@create-figma-plugin/utilities";

export interface SyncParams {
  styleIds: string[];
  opacities: number[];
  pattern: string;
  shouldClean: boolean;
}

export interface LocalSolidColorStyle {
  id: string;
  name: string;
  color: RGB;
}

export interface ParamSettings {
  params: Omit<SyncParams, "styleIds">;
}

export interface ColorSettings {}

export interface InitHandler extends EventHandler {
  name: "INIT";
  handler: () => void;
}

export interface InitStylesHandler extends EventHandler {
  name: "INIT_STYLES";
  handler: (styles: LocalSolidColorStyle[]) => void;
}

export interface InitParamsHandler extends EventHandler {
  name: "INIT_PARAMS";
  handler: (params: Omit<SyncParams, "styleIds">) => void;
}

export interface CloseHandler extends EventHandler {
  name: "CLOSE";
  handler: () => void;
}

export interface SyncStylesHandler extends EventHandler {
  name: "SYNC_STYLES";
  handler: (params: SyncParams) => void;
}
