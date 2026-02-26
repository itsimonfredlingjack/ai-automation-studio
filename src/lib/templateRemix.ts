export interface TemplateRemixMetadata {
  chain_depth: number;
  root_template_name: string;
}

export function parseTemplateRemixMetadata(
  value: unknown
): TemplateRemixMetadata | undefined {
  if (!isObject(value)) return undefined;

  const depth = value.chain_depth;
  const rootTemplateName = value.root_template_name;
  if (typeof depth !== "number" || !Number.isInteger(depth) || depth < 1) {
    return undefined;
  }
  if (typeof rootTemplateName !== "string" || !rootTemplateName.trim()) {
    return undefined;
  }

  return {
    chain_depth: depth,
    root_template_name: rootTemplateName.trim(),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
