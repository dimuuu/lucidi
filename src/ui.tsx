import { h } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  Bold,
  Button,
  Checkbox,
  Columns,
  Container,
  MiddleAlign,
  Muted,
  Preview,
  render,
  Stack,
  Text,
  Textbox,
  TextboxNumeric,
  VerticalSpace,
} from "@create-figma-plugin/ui";
import { emit, once } from "@create-figma-plugin/utilities";

import {
  CloseHandler,
  InitHandler,
  InitParamsHandler,
  InitStylesHandler,
  LocalSolidColorStyle,
  SyncStylesHandler,
} from "./types";
import { matchNamePattern } from "./helpers";

const ColorStyleCircle = ({
  color,
  opacity,
}: {
  color: RGB;
  opacity: number;
}) => {
  const solidColor = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${opacity / 100})`;

  return (
    <div
      style={{
        position: "relative",
        height: "16px",
        width: "16px",
        borderRadius: "50%",
      }}
    >
      <div
        style={{
          position: "absolute",
          height: "16px",
          width: "16px",
          borderRadius: "50%",
          background: `linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.098) 25%,
            transparent 25%,
            transparent 75%,
            rgba(0, 0, 0, 0.098) 75%,
            rgba(0, 0, 0, 0.098) 0
          ),
          linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.098) 25%,
            transparent 25%,
            transparent 75%,
            rgba(0, 0, 0, 0.098) 75%,
            rgba(0, 0, 0, 0.098) 0
          ),
          var(--figma-color-bg-secondary)`,
          backgroundRepeat: "repeat, repeat",
          backgroundPosition: "0px 0, 4px 4px",
          transformOrigin: "0 0 0",
          backgroundOrigin: "padding-box, padding-box",
          backgroundClip: "border-box, border-box",
          backgroundSize: "8px 8px, 8px 8px",
        }}
      />
      <div
        style={{
          position: "absolute",
          height: "16px",
          width: "16px",
          borderRadius: "50%",
          background:
            "linear-gradient(45deg, var(--figma-color-bg-secondary) 50%, transparent 50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          height: "16px",
          width: "16px",
          borderRadius: "50%",
          backgroundColor: solidColor,
        }}
      />
      <div
        style={{
          position: "absolute",
          height: "18px",
          width: "18px",
          left: "-1px",
          top: "-1px",
          borderRadius: "50%",
          boxShadow: "inset 0 0 0 1.5px var(--figma-color-bg-secondary)",
        }}
      />
    </div>
  );
};

function Plugin() {
  const [styles, setStyles] = useState<LocalSolidColorStyle[]>([]);
  const [opacitiesString, setOpacitiesString] = useState<string>("");
  const [pattern, setPattern] = useState<string>("");
  const [shouldClean, setShouldClean] = useState<boolean>(false);
  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<string>>(
    new Set<string>(),
  );

  const opacities = useMemo(
    () =>
      opacitiesString
        .split(",")
        .map((value) => value.trim())
        .map((value) => parseInt(value, 10))
        .filter((value) => !isNaN(value))
        .filter((value) => value >= 1 && value <= 99)
        .sort((a, b) => b - a),
    [opacitiesString],
  );

  const handleCloseButtonClick = useCallback(function () {
    emit<CloseHandler>("CLOSE");
  }, []);

  const handleSyncStyles = useCallback(
    function () {
      emit<SyncStylesHandler>("SYNC_STYLES", {
        styleIds: Array.from(selectedStyleIds),
        opacities,
        pattern,
        shouldClean,
      });
    },
    [selectedStyleIds, opacities, pattern, shouldClean],
  );

  const handleAppendStyleName = useCallback(function () {
    setPattern((pattern) => pattern + "$N");
  }, []);

  const handleAppendOpacity = useCallback(function () {
    setPattern((pattern) => pattern + "$A");
  }, []);

  const handleSelectStyle = useCallback(
    (styleId: string) => {
      setSelectedStyleIds((selectedStyleIds) => {
        const newSelectedStyleIds = new Set(selectedStyleIds);
        if (newSelectedStyleIds.has(styleId)) {
          newSelectedStyleIds.delete(styleId);
        } else {
          newSelectedStyleIds.add(styleId);
        }
        return newSelectedStyleIds;
      });
    },
    [setSelectedStyleIds],
  );

  useEffect(() => {
    emit<InitHandler>("INIT");

    once<InitParamsHandler>("INIT_PARAMS", (params) => {
      setOpacitiesString(params.opacities.join(", "));
      setPattern(params.pattern);
      setShouldClean(params.shouldClean);
    });

    once<InitStylesHandler>("INIT_STYLES", (styles) => {
      setStyles(styles);

      styles.forEach((style) => {
        handleSelectStyle(style.id);
      });
    });
  }, []);

  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      <Stack space="large">
        <Columns space="large">
          <div>
            <Text>
              <Muted>
                Sync and update solid colors and matching opacity styles in the
                local library.
              </Muted>
            </Text>
            <VerticalSpace space="large" />
            <Text>Opacity styles</Text>
            <VerticalSpace space="small" />
            <Textbox
              onValueInput={setOpacitiesString}
              value={opacitiesString}
              variant="border"
            />
            <VerticalSpace space="small" />
            <Text>
              <Muted>
                Enter values in [0-100] range separated with commas.
              </Muted>
            </Text>
            <VerticalSpace space="large" />
            <Text>Name pattern</Text>
            <VerticalSpace space="small" />
            <Textbox
              onValueInput={setPattern}
              value={pattern}
              variant="border"
            />
            <VerticalSpace space="small" />
            <Columns space="extraSmall">
              <Button fullWidth secondary onClick={handleAppendStyleName}>
                Style name
              </Button>
              <Button fullWidth secondary onClick={handleAppendOpacity}>
                Opacity
              </Button>
            </Columns>
          </div>

          <Stack space="small">
            <Text>
              <Bold>Preview new styles</Bold>
            </Text>
            <Preview
              style={{ width: "200px", height: "212px", overflowX: "hidden" }}
            >
              <Stack space="large">
                {styles.map((style) => (
                  <Container space="small" key={style.id}>
                    <div style={{ margin: "0px 2px" }}>
                      <Checkbox
                        onChange={() => handleSelectStyle(style.id)}
                        value={selectedStyleIds.has(style.id)}
                      >
                        <Text>{style.name}</Text>
                      </Checkbox>
                    </div>
                    <VerticalSpace space="small" />
                    <Stack space="extraSmall">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <ColorStyleCircle color={style.color} opacity={100} />
                        <Text>
                          <Muted>{style.name}</Muted>
                        </Text>
                      </div>
                      {pattern.length > 0 &&
                        opacities.map((opacity) => {
                          const name = matchNamePattern(pattern, {
                            N: style.name,
                            A: opacity,
                          });

                          return (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <ColorStyleCircle
                                color={style.color}
                                opacity={opacity}
                              />
                              <Text>
                                <Muted>{name}</Muted>
                              </Text>
                            </div>
                          );
                        })}
                    </Stack>
                  </Container>
                ))}
              </Stack>
            </Preview>
          </Stack>
        </Columns>

        <Columns space="extraSmall">
          <div
            style={{ display: "flex", alignItems: "center", height: "100%" }}
          >
            <Checkbox
              onChange={(event) => setShouldClean(event.currentTarget.checked)}
              value={shouldClean}
            >
              <Text>Clean up unused opacity styles</Text>
            </Checkbox>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              height: "100%",
            }}
          >
            <Button
              onClick={handleSyncStyles}
              disabled={opacities.length < 1 && selectedStyleIds.size < 1}
            >
              Create & sync styles
            </Button>
          </div>
        </Columns>
      </Stack>
      <VerticalSpace space="large" />
    </Container>
  );
}

export default render(Plugin);
