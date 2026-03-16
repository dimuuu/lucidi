import { EventHandler } from "@create-figma-plugin/utilities";

// --- Data types ---

/** A source color variable suitable for opacity variant generation */
export interface LocalColorVariable {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  color: RGBA;
}

/** Lightweight representation of a variable collection for the UI */
export interface VariableCollectionInfo {
  id: string;
  name: string;
}

/** Persisted user settings */
export interface ParamSettings {
  params: {
    opacities: number[];
    pattern: string;
    shouldClean: boolean;
    targetCollectionName: string;
  };
}

/** Payload sent from UI to plugin to trigger sync */
export interface SyncParams {
  variableIds: string[];
  opacities: number[];
  pattern: string;
  shouldClean: boolean;
  targetCollectionName: string;
}

// --- Event handler interfaces ---

export interface InitHandler extends EventHandler {
  name: "INIT";
  handler: () => void;
}

export interface InitDataHandler extends EventHandler {
  name: "INIT_DATA";
  handler: (data: {
    variables: LocalColorVariable[];
    collections: VariableCollectionInfo[];
    params: ParamSettings["params"];
  }) => void;
}

export interface SyncVariablesHandler extends EventHandler {
  name: "SYNC_VARIABLES";
  handler: (params: SyncParams) => void;
}

export interface SyncProgressHandler extends EventHandler {
  name: "SYNC_PROGRESS";
  handler: (progress: { current: number; total: number; phase: string }) => void;
}

export interface SyncCompleteHandler extends EventHandler {
  name: "SYNC_COMPLETE";
  handler: (result: {
    created: number;
    updated: number;
    removed: number;
  }) => void;
}

export interface CloseHandler extends EventHandler {
  name: "CLOSE";
  handler: () => void;
}
