import { h, render as preactRender } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  Badge,
  Button,
  Checkbox,
  Icon,
  Input,
  ScrollContainer,
  Section,
  Spacing,
  Spinner,
  Stack,
  Text,
  check,
} from "figma-plugin-preact-ui";
import "figma-plugin-preact-ui/dist/style.css";
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
    <Section
      padding={{ top: "400", right: "400", bottom: "400", left: "400" }}
    >
      <Stack spacing="400">
        <Stack direction="row" spacing="400">
          <Stack spacing="200" fullWidth>
            <Text intentModifiers="secondary">
              Sync and update color variables with opacity variants in the
              local library.
            </Text>
            <Spacing size="200" />
            <Text strong>Opacity values</Text>
            <Input
              onChange={({ value }) => setOpacitiesString(value)}
              value={opacitiesString}
            />
            <Text size="small" intentModifiers="secondary">
              Enter values in [1-99] range separated with commas.
            </Text>
            <Spacing size="200" />
            <Text strong>Name pattern</Text>
            <Input
              onChange={({ value }) => setPattern(value)}
              value={pattern}
            />
            <Stack direction="row" spacing="100">
              <Button
                fullWidth
                intent="neutral"
                onClick={handleAppendVariableName}
              >
                Variable name
              </Button>
              <Button
                fullWidth
                intent="neutral"
                onClick={handleAppendOpacity}
              >
                Opacity
              </Button>
            </Stack>
            <Spacing size="200" />
            <Text strong>Target collection</Text>
            <Input
              onChange={({ value }) => setTargetCollectionName(value)}
              value={targetCollectionName}
            />
          </Stack>

          <Stack spacing="200" fullWidth>
            <Stack direction="row" spacing="100" y="center">
              <Text strong>Preview</Text>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "4px",
                  flex: 1,
                }}
              >
                <Button intent="neutral" onClick={handleSelectAll}>
                  All
                </Button>
                <Button intent="neutral" onClick={handleDeselectAll}>
                  None
                </Button>
              </div>
            </Stack>
            <div
              style={{
                width: "200px",
                height: "248px",
                overflow: "auto",
                border: "1px solid var(--figma-color-border)",
                borderRadius: "4px",
              }}
            >
              <Stack spacing="400">
                {variables.map((variable) => (
                  <Section
                    key={variable.id}
                    padding={{
                      top: "200",
                      right: "200",
                      bottom: "200",
                      left: "200",
                    }}
                  >
                    <Checkbox
                      onChange={() => handleSelectVariable(variable.id)}
                      checked={selectedVariableIds.has(variable.id)}
                      label={variable.name}
                    />
                    <Spacing size="200" />
                    <Stack spacing="100">
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
                        <Text size="small" intentModifiers="secondary">
                          {variable.name}
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
                              <Text size="small" intentModifiers="secondary">
                                {name}
                              </Text>
                            </div>
                          );
                        })}
                    </Stack>
                  </Section>
                ))}
              </Stack>
            </div>
          </Stack>
        </Stack>

        {isLoading && progress && (
          <Stack direction="row" spacing="200" y="center">
            <Spinner />
            <Text intentModifiers="secondary">
              {progress.phase} ({progress.current}/{progress.total})
            </Text>
          </Stack>
        )}

        {syncResult && !isLoading && (
          <Badge intent="success" prefix={<Icon glyph={check} size={16} />}>
            {syncResult.created} created, {syncResult.updated} updated,{" "}
            {syncResult.removed} removed
          </Badge>
        )}

        <Stack direction="row" spacing="100" y="center">
          <div style={{ flex: 1 }}>
            <Checkbox
              onChange={({ checked }) => setShouldClean(checked)}
              checked={shouldClean}
              label="Clean up unused variants"
            />
          </div>
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
        </Stack>
      </Stack>
    </Section>
  );
}

export default function (rootNode: HTMLElement) {
  preactRender(h(Plugin, {}), rootNode);
}
