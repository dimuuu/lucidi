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
  InitHandler,
  InitParamsHandler,
  InitStylesHandler,
  LocalSolidColorStyle,
  ParamSettings,
  SyncStylesHandler,
} from "./types";
import { matchNamePattern } from "./helpers";

const defaultSettings: ParamSettings = {
  params: {
    opacities: [10, 20, 40, 80],
    pattern: "$N $A%",
    shouldClean: true,
  },
};

export default function () {
  const getLocalSolidColorStyles = async () => {
    const paints = await figma.getLocalPaintStylesAsync();

    return paints
      .filter(
        (style) =>
          style.paints.length === 1 &&
          style.paints[0].type === "SOLID" &&
          style.paints[0].opacity === 1,
      )
      .map(
        (style) =>
          ({
            id: style.id,
            name: style.name,
            color: (style.paints[0] as SolidPaint).color,
          }) as LocalSolidColorStyle,
      );
  };

  const getExistingOpacityStyles = async () => {
    const paints = await figma.getLocalPaintStylesAsync();

    return paints.filter((style) => style.getPluginData("key"));
  };

  once<InitHandler>("INIT", async () => {
    const solidColorStyles = await getLocalSolidColorStyles();

    const settings = await loadSettingsAsync(defaultSettings, "params");

    emit<InitStylesHandler>(
      "INIT_STYLES",
      solidColorStyles.map((style) => ({
        id: style.id,
        name: style.name,
        color: style.color,
      })),
    );

    emit<InitParamsHandler>("INIT_PARAMS", settings.params);
  });

  on<SyncStylesHandler>(
    "SYNC_STYLES",
    async ({ styleIds, opacities, pattern, shouldClean }) => {
      const settings: ParamSettings = {
        params: {
          opacities,
          pattern,
          shouldClean,
        },
      };

      await saveSettingsAsync(settings, "params");

      const solidColorStyles = await getLocalSolidColorStyles();

      solidColorStyles.forEach(async (style) => {
        if (!styleIds.some((s) => s === style.id)) return;
        const color = style.color;
        const originalStyleId = style.id;

        const existingOpacityStyles = await getExistingOpacityStyles();

        if (shouldClean) {
          existingOpacityStyles.forEach((opacityStyle) => {
            const opacityValue = opacityStyle
              .getPluginData("key")
              .split("_")[1];

            const opacityStyleId = opacityStyle
              .getPluginData("key")
              .split("_")[0];

            if (
              !opacities.includes(Number(opacityValue)) &&
              styleIds.includes(opacityStyleId)
            ) {
              opacityStyle.remove();
            }
          });
        }

        opacities.forEach(async (opacity) => {
          const opacityStyleName = matchNamePattern(pattern, {
            N: style.name,
            A: opacity,
          });
          const opacityStyleKey = `${originalStyleId}_${opacity}`;

          const paints = await figma.getLocalPaintStylesAsync();

          let opacityStyle = paints.find(
            (s) => s.getPluginData("key") === opacityStyleKey,
          );

          if (!opacityStyle) {
            opacityStyle = figma.createPaintStyle();
            opacityStyle.setPluginData("key", opacityStyleKey);
          }

          opacityStyle.name = opacityStyleName;
          opacityStyle.paints = [
            { type: "SOLID", color, opacity: opacity / 100 },
          ];
        });
      });

      const existingOpacityStyles = await getExistingOpacityStyles();

      existingOpacityStyles.forEach((opacityStyle) => {
        const originalStyleId = opacityStyle.getPluginData("key").split("_")[0];
        if (!solidColorStyles.find((s) => s.id === originalStyleId)) {
          try {
            opacityStyle.remove();
          } catch (e) {
            console.log(e);
          }
        }
      });

      // figma.closePlugin();
    },
  );

  once<CloseHandler>("CLOSE", function () {
    figma.closePlugin();
  });

  showUI({
    height: 316,
    width: 480,
  });
}
