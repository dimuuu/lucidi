export const matchNamePattern = (
  input: string,
  variables: Record<string, string | number | undefined>,
): string => {
  const pattern = /\$(N|A)/g;

  return input.replace(pattern, (_, name) => {
    const value = variables[name];
    return value !== undefined ? String(value) : "Untitled";
  });
};

/** Extract the RGBA color from a variable's default mode value */
export function getVariableDefaultColor(
  variable: Variable,
  collection: VariableCollection,
): RGBA | null {
  const defaultModeId = collection.modes[0].modeId;
  const value = variable.valuesByMode[defaultModeId];
  if (
    value !== undefined &&
    typeof value === "object" &&
    "r" in value &&
    "g" in value &&
    "b" in value
  ) {
    return value as RGBA;
  }
  return null;
}
