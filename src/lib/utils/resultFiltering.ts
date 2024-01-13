import { NestedParams } from "prisma-nested-middleware";

import { ModelConfig } from "../types";

export function shouldFilterDeletedFromReadResult(
  params: NestedParams,
  config: ModelConfig
): boolean {
  return (
    !params.scope?.relations.to.isList &&
    (!params.args.where ||
      typeof params.args.where[config.field] === "undefined" ||
      params.args.where[config.field] === config.createValue(false))
  );
}

export function filterSoftDeletedResults(result: any, config: ModelConfig) {
  // filter out deleted records from array results
  if (result && Array.isArray(result)) {
    return result.filter(
      (item) => item[config.field] === config.createValue(false)
    );
  }

  // if the result is deleted return null
  if (result && result[config.field] !== config.createValue(false)) {
    return null;
  }

  return result;
}
