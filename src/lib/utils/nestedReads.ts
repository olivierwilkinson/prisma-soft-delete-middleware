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

export function isDeletedFieldOverWritten(field: string, where?: any): boolean {
  if (!where) {
    return false
  }
  if (where[field] !== undefined) {
    return true
  }
  if (where.OR && Array.isArray(where.OR)) {
    const isDeletedFieldOverWrittenInOR = where.OR.some((arg: any) => {
      return isDeletedFieldOverWritten(field, arg)
    })
    if (isDeletedFieldOverWrittenInOR) {
      return true
    }
  }
  if (where.AND && Array.isArray(where.AND)) {
    const isDeletedFieldOverWrittenInAND = where.AND.some((arg: any) => {
      return isDeletedFieldOverWritten(field, arg)
    })
    if (isDeletedFieldOverWrittenInAND) {
      return true
    }
  }
  return false
}