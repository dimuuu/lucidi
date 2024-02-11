import { MESSAGE } from "./constants";
import { matchNamePattern } from "./helpers";
import { InitialStyle } from "./types";

figma.showUI(__html__, { width: 480, height: 316, themeColors: true });

const getLocalSolidColorStyles = () => {
  return figma
    .getLocalPaintStyles()
    .filter(
      (style) =>
        style.paints.length === 1 &&
        style.paints[0].type === "SOLID" &&
        style.paints[0].opacity === 1
    );
};

const getExistingOpacityStyles = () => {
  return figma
    .getLocalPaintStyles()
    .filter((style) => style.getPluginData("key"));
};

let solidColorStyles = getLocalSolidColorStyles();

const lastParams = JSON.parse(figma.root.getPluginData("lastParams")) || {};

figma.ui.postMessage({
  type: MESSAGE.INIT_STYLES,
  styles: solidColorStyles.map((style) => {
    if (style.paints[0].type !== "SOLID") return;
    if (style.paints[0].opacity !== 1) return;
    if (style.paints.length !== 1) return;
    return {
      id: style.id,
      name: style.name,
      color: style.paints[0].color,
    } as InitialStyle;
  }),
});

figma.ui.postMessage({
  type: MESSAGE.INIT_PARAMS,
  params: lastParams,
});

figma.ui.onmessage = (message) => {
  solidColorStyles = getLocalSolidColorStyles();

  if (message.type === MESSAGE.SYNC_STYLES) {
    const { opacities, pattern, shouldClean, toSync } = message;

    figma.root.setPluginData(
      "lastParams",
      JSON.stringify({ opacities, pattern, shouldClean })
    );

    solidColorStyles.forEach((style) => {
      if (style.paints[0].type !== "SOLID") return;
      if (style.paints[0].opacity !== 1) return;
      if (style.paints.length !== 1) return;
      if (!toSync.some((s: InitialStyle) => s.id === style.id)) return;

      const color = style.paints[0].color;
      const originalStyleId = style.id;

      // Clean up any existing opacity styles
      if (shouldClean) {
        const existingOpacityStyles = getExistingOpacityStyles();

        existingOpacityStyles.forEach((opacityStyle) => {
          const opacityValue = opacityStyle.getPluginData("key").split("_")[1];
          if (!opacities.includes(Number(opacityValue))) {
            try {
              opacityStyle.remove();
            } catch (e) {
              console.log(e);
            }
          }
        });
      }

      // Loop through the opacities array and create a new style for each one
      opacities.forEach((opacity) => {
        const opacityStyleName = matchNamePattern(pattern, {
          N: style.name,
          A: opacity,
        });

        const opacityStyleKey = `${originalStyleId}_${opacity}`;

        // Check if the opacity style already exists
        let opacityStyle = figma.getLocalPaintStyles().find((style) => {
          const key = style.getPluginData("key");
          return key === opacityStyleKey;
        });

        if (opacityStyle) {
          // If the opacity style already exists, update the name
          opacityStyle.name = opacityStyleName;
        }

        if (!opacityStyle) {
          // Create a new opacity style if it doesn't exist
          opacityStyle = figma.createPaintStyle();
          opacityStyle.name = opacityStyleName;
          opacityStyle.setPluginData("key", opacityStyleKey);
        }

        // Update the color of the opacity style to match the original color with the new opacity value
        const newColor = {
          r: color.r,
          g: color.g,
          b: color.b,
        };
        opacityStyle.paints = [
          { type: "SOLID", color: newColor, opacity: opacity / 100 },
        ];
      });
    });

    // Delete any opacity styles that no longer have a corresponding solid color
    const existingOpacityStyles = getExistingOpacityStyles();

    existingOpacityStyles.forEach((opacityStyle) => {
      const originalStyleId = opacityStyle.getPluginData("key").split("_")[0];
      if (!solidColorStyles.find((style) => style.id === originalStyleId)) {
        try {
          opacityStyle.remove();
        } catch (e) {
          console.log(e);
        }
      }
    });

    figma.closePlugin();
  }
};
