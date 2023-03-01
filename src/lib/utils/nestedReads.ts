import { NestedParams } from "prisma-nested-middleware";

import { ModelConfig } from "../types";

export function addDeletedToSelect(params: NestedParams, config: ModelConfig) {
  if (params.args.select && !params.args.select[config.field]) {
    return {
      ...params,
      args: {
        __deletedFieldAdded: true,
        ...params.args,
        select: {
          ...params.args.select,
          [config.field]: true,
        },
      },
    };
  }

  return params;
}

export function stripDeletedFieldFromResults(
  results: any,
  config: ModelConfig
) {
  if (Array.isArray(results)) {
    results?.forEach((item: any) => {
      delete item[config.field];
    });
  } else if (results) {
    delete results[config.field];
  }

  return results;
}
