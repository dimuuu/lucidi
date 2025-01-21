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
