export const matchNamePattern = (input: string, variables: any) => {
  const pattern = /\$(N|A)/g;

  const replaced = input.replace(pattern, (match, name) => {
    const value = variables[name];

    return value !== undefined ? value : match;
  });

  return replaced;
};
