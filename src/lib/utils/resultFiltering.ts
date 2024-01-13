import { NestedParams } from "prisma-nested-middleware";
import isEqual from "lodash/isEqual";

import { ModelConfig } from "../types";

export function shouldFilterDeletedFromReadResult(
  params: NestedParams,
  config: ModelConfig
): boolean {
  return (
    !params.scope?.relations.to.isList &&
    (!params.args.where ||
      typeof params.args.where[config.field] === "undefined" ||
      isEqual(params.args.where[config.field], config.createValue(false)))
  );
}

export function filterSoftDeletedResults(result: any, config: ModelConfig) {
  // filter out deleted records from array results
  if (result && Array.isArray(result)) {
    return result.filter((item) =>
      isEqual(item[config.field], config.createValue(false))
    );
  }

  // if the result is deleted return null
  if (result && !isEqual(result[config.field], config.createValue(false))) {
    return null;
  }

  return result;
}
