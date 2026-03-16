import {
  emit,
  loadSettingsAsync,
  on,
  once,
  saveSettingsAsync,
  showUI,
} from "@create-figma-plugin/utilities";

import {
  CloseHandler,
  InitDataHandler,
  InitHandler,
  LocalColorVariable,
  ParamSettings,
  SyncCompleteHandler,
  SyncProgressHandler,
  SyncVariablesHandler,
  VariableCollectionInfo,
} from "./types";
import { getVariableDefaultColor, matchNamePattern } from "./helpers";

const defaultSettings: ParamSettings = {
  params: {
    opacities: [10, 20, 40, 80],
    pattern: "$N $A%",
    shouldClean: true,
    targetCollectionName: "Lucidi Alphas",
  },
};

export default function () {
  once<InitHandler>("INIT", async () => {
    const [allColorVars, allCollections] = await Promise.all([
      figma.variables.getLocalVariablesAsync("COLOR"),
      figma.variables.getLocalVariableCollectionsAsync(),
    ]);

    const collectionMap = new Map(allCollections.map((c) => [c.id, c]));

    // Source candidates: fully opaque color variables, excluding our generated variants
    const sourceVariables: LocalColorVariable[] = [];
    for (const v of allColorVars) {
      if (v.getPluginData("key")) continue;
      const coll = collectionMap.get(v.variableCollectionId);
      if (!coll) continue;
      const color = getVariableDefaultColor(v, coll);
      if (!color) continue;
      if (color.a !== undefined && color.a < 1) continue;
      sourceVariables.push({
        id: v.id,
        name: v.name,
        collectionId: coll.id,
        collectionName: coll.name,
        color,
      });
    }

    const collections: VariableCollectionInfo[] = allCollections.map((c) => ({
      id: c.id,
      name: c.name,
    }));

    const settings = await loadSettingsAsync(defaultSettings, "params");

    emit<InitDataHandler>("INIT_DATA", {
      variables: sourceVariables,
      collections,
      params: settings.params,
    });
  });

  on<SyncVariablesHandler>("SYNC_VARIABLES", async (params) => {
    const {
      variableIds,
      opacities,
      pattern,
      shouldClean,
      targetCollectionName,
    } = params;

    try {
      // 1. Save settings
      await saveSettingsAsync(
        {
          params: { opacities, pattern, shouldClean, targetCollectionName },
        },
        "params",
      );

      // 2. Single fetch of all data upfront
      const [allColorVars, allCollections] = await Promise.all([
        figma.variables.getLocalVariablesAsync("COLOR"),
        figma.variables.getLocalVariableCollectionsAsync(),
      ]);

      const collectionMap = new Map(allCollections.map((c) => [c.id, c]));
      const variableMap = new Map(allColorVars.map((v) => [v.id, v]));

      // 3. Find or create target collection
      const existingGenerated = allColorVars.find((v) =>
        v.getPluginData("key"),
      );
      let targetCollection: VariableCollection | null = null;
      if (existingGenerated) {
        targetCollection =
          collectionMap.get(existingGenerated.variableCollectionId) ?? null;
      }
      if (!targetCollection) {
        // Check if a collection with the target name already exists
        const existing = allCollections.find(
          (c) => c.name === targetCollectionName,
        );
        if (existing) {
          targetCollection = existing;
        } else {
          targetCollection =
            figma.variables.createVariableCollection(targetCollectionName);
        }
      }
      const targetModeId = targetCollection.modes[0].modeId;

      // 4. Index existing generated variables by pluginData key
      const existingByKey = new Map<string, Variable>();
      for (const v of allColorVars) {
        const key = v.getPluginData("key");
        if (key && v.variableCollectionId === targetCollection.id) {
          existingByKey.set(key, v);
        }
      }

      // 5. Build desired keys and create/update variants
      const desiredKeys = new Set<string>();
      const selectedSources = variableIds
        .map((id) => variableMap.get(id))
        .filter((v): v is Variable => v !== undefined);

      let created = 0;
      let updated = 0;
      const total = selectedSources.length * opacities.length;
      let current = 0;

      for (const sourceVar of selectedSources) {
        const sourceColl = collectionMap.get(sourceVar.variableCollectionId);
        if (!sourceColl) continue;
        const sourceColor = getVariableDefaultColor(sourceVar, sourceColl);
        if (!sourceColor) continue;

        for (const opacity of opacities) {
          const key = `${sourceVar.id}_${opacity}`;
          desiredKeys.add(key);

          const varName = matchNamePattern(pattern, {
            N: sourceVar.name,
            A: opacity,
          });

          const target = existingByKey.get(key);
          if (target) {
            target.name = varName;
            target.setValueForMode(targetModeId, {
              r: sourceColor.r,
              g: sourceColor.g,
              b: sourceColor.b,
              a: opacity / 100,
            });
            updated++;
          } else {
            const newVar = figma.variables.createVariable(
              varName,
              targetCollection,
              "COLOR",
            );
            newVar.setPluginData("key", key);
            newVar.setValueForMode(targetModeId, {
              r: sourceColor.r,
              g: sourceColor.g,
              b: sourceColor.b,
              a: opacity / 100,
            });
            created++;
          }

          current++;
          emit<SyncProgressHandler>("SYNC_PROGRESS", {
            current,
            total,
            phase: "Generating variables",
          });
        }
      }

      // 6. Cleanup stale variants only if shouldClean is true
      let removed = 0;
      if (shouldClean) {
        existingByKey.forEach((variable, key) => {
          if (!desiredKeys.has(key)) {
            try {
              variable.remove();
              removed++;
            } catch {
              // already removed
            }
          }
        });
      }

      emit<SyncCompleteHandler>("SYNC_COMPLETE", { created, updated, removed });
      figma.notify(
        `Done: ${created} created, ${updated} updated, ${removed} removed`,
      );
    } catch (error) {
      emit<SyncCompleteHandler>("SYNC_COMPLETE", {
        created: 0,
        updated: 0,
        removed: 0,
      });
      figma.notify(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });

  once<CloseHandler>("CLOSE", function () {
    figma.closePlugin();
  });

  showUI({
    height: 380,
    width: 480,
  });
}
