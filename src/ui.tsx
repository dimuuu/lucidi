import { h } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  Banner,
  Bold,
  Button,
  Checkbox,
  Columns,
  Container,
  IconCheckCircle32,
  LoadingIndicator,
  Muted,
  Preview,
  render,
  Stack,
  Text,
  Textbox,
  VerticalSpace,
} from "@create-figma-plugin/ui";
import { emit, on, once } from "@create-figma-plugin/utilities";

import {
  CloseHandler,
  InitDataHandler,
  InitHandler,
  LocalColorVariable,
  SyncCompleteHandler,
  SyncProgressHandler,
  SyncVariablesHandler,
} from "./types";
import { matchNamePattern } from "./helpers";

const ColorStyleCircle = ({
  color,
  opacity,
}: {
  color: RGBA;
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
  const [variables, setVariables] = useState<LocalColorVariable[]>([]);
  const [opacitiesString, setOpacitiesString] = useState<string>("");
  const [pattern, setPattern] = useState<string>("");
  const [shouldClean, setShouldClean] = useState<boolean>(false);
  const [targetCollectionName, setTargetCollectionName] =
    useState<string>("Lucidi Alphas");
  const [selectedVariableIds, setSelectedVariableIds] = useState<Set<string>>(
    new Set<string>(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    phase: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    updated: number;
    removed: number;
  } | null>(null);

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

  const handleSyncVariables = useCallback(
    function () {
      setIsLoading(true);
      setSyncResult(null);
      emit<SyncVariablesHandler>("SYNC_VARIABLES", {
        variableIds: Array.from(selectedVariableIds),
        opacities,
        pattern,
        shouldClean,
        targetCollectionName,
      });
    },
    [selectedVariableIds, opacities, pattern, shouldClean, targetCollectionName],
  );

  const handleAppendVariableName = useCallback(function () {
    setPattern((pattern) => pattern + "$N");
  }, []);

  const handleAppendOpacity = useCallback(function () {
    setPattern((pattern) => pattern + "$A");
  }, []);

  const handleSelectVariable = useCallback(
    (variableId: string) => {
      setSelectedVariableIds((prev) => {
        const next = new Set(prev);
        if (next.has(variableId)) {
          next.delete(variableId);
        } else {
          next.add(variableId);
        }
        return next;
      });
    },
    [setSelectedVariableIds],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedVariableIds(new Set(variables.map((v) => v.id)));
  }, [variables]);

  const handleDeselectAll = useCallback(() => {
    setSelectedVariableIds(new Set());
  }, []);

  useEffect(() => {
    emit<InitHandler>("INIT");

    once<InitDataHandler>("INIT_DATA", ({ variables, collections, params }) => {
      setVariables(variables);
      setOpacitiesString(params.opacities.join(", "));
      setPattern(params.pattern);
      setShouldClean(params.shouldClean);
      setTargetCollectionName(params.targetCollectionName);
      setSelectedVariableIds(new Set(variables.map((v) => v.id)));
    });

    on<SyncProgressHandler>("SYNC_PROGRESS", (p) => {
      setProgress(p);
    });

    on<SyncCompleteHandler>("SYNC_COMPLETE", (result) => {
      setSyncResult(result);
      setIsLoading(false);
      setProgress(null);
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
                Sync and update color variables with opacity variants in the
                local library.
              </Muted>
            </Text>
            <VerticalSpace space="large" />
            <Text>Opacity values</Text>
            <VerticalSpace space="small" />
            <Textbox
              onValueInput={setOpacitiesString}
              value={opacitiesString}
              variant="border"
            />
            <VerticalSpace space="small" />
            <Text>
              <Muted>
                Enter values in [1-99] range separated with commas.
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
              <Button fullWidth secondary onClick={handleAppendVariableName}>
                Variable name
              </Button>
              <Button fullWidth secondary onClick={handleAppendOpacity}>
                Opacity
              </Button>
            </Columns>
            <VerticalSpace space="large" />
            <Text>Target collection</Text>
            <VerticalSpace space="small" />
            <Textbox
              onValueInput={setTargetCollectionName}
              value={targetCollectionName}
              variant="border"
            />
          </div>

          <Stack space="small">
            <Columns space="extraSmall">
              <Text>
                <Bold>Preview</Bold>
              </Text>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "4px",
                }}
              >
                <Button secondary onClick={handleSelectAll}>
                  All
                </Button>
                <Button secondary onClick={handleDeselectAll}>
                  None
                </Button>
              </div>
            </Columns>
            <Preview
              style={{ width: "200px", height: "248px", overflowX: "hidden" }}
            >
              <Stack space="large">
                {variables.map((variable) => (
                  <Container space="small" key={variable.id}>
                    <div style={{ margin: "0px 2px" }}>
                      <Checkbox
                        onChange={() => handleSelectVariable(variable.id)}
                        value={selectedVariableIds.has(variable.id)}
                      >
                        <Text>{variable.name}</Text>
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
                        <ColorStyleCircle
                          color={variable.color}
                          opacity={100}
                        />
                        <Text>
                          <Muted>{variable.name}</Muted>
                        </Text>
                      </div>
                      {pattern.length > 0 &&
                        opacities.map((opacity) => {
                          const name = matchNamePattern(pattern, {
                            N: variable.name,
                            A: opacity,
                          });

                          return (
                            <div
                              key={`${variable.id}-${opacity}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <ColorStyleCircle
                                color={variable.color}
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

        {isLoading && progress && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <LoadingIndicator />
            <Text>
              <Muted>
                {progress.phase} ({progress.current}/{progress.total})
              </Muted>
            </Text>
          </div>
        )}

        {syncResult && !isLoading && (
          <Banner icon={<IconCheckCircle32 />}>
            {syncResult.created} created, {syncResult.updated} updated,{" "}
            {syncResult.removed} removed
          </Banner>
        )}

        <Columns space="extraSmall">
          <div
            style={{ display: "flex", alignItems: "center", height: "100%" }}
          >
            <Checkbox
              onChange={(event) => setShouldClean(event.currentTarget.checked)}
              value={shouldClean}
            >
              <Text>Clean up unused variants</Text>
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
              onClick={handleSyncVariables}
              disabled={
                opacities.length < 1 ||
                selectedVariableIds.size < 1 ||
                isLoading
              }
            >
              Create & sync variables
            </Button>
          </div>
        </Columns>
      </Stack>
      <VerticalSpace space="large" />
    </Container>
  );
}

export default render(Plugin);
