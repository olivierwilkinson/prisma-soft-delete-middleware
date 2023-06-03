import { Prisma } from "@prisma/client";
import { NestedParams, NestedMiddleware } from "prisma-nested-middleware";

import { ModelConfig } from "./types";
import {
  addDeletedToSelect,
  stripDeletedFieldFromResults,
} from "./utils/nestedReads";
import {
  filterSoftDeletedResults,
  shouldFilterDeletedFromReadResult,
} from "./utils/resultFiltering";

/* Delete middleware */

function createDeleteParams(
  params: NestedParams,
  { field, createValue }: ModelConfig
): NestedParams | NestedParams[] {
  if (
    !params.model ||
    // do nothing for delete: false
    (typeof params.args === "boolean" && !params.args) ||
    // do nothing for root delete without where to allow Prisma to throw
    (!params.scope && !params.args?.where)
  ) {
    return params;
  }

  if (typeof params.args === "boolean") {
    return {
      ...params,
      action: "update",
      args: {
        __passUpdateThrough: true,
        [field]: createValue(true),
      },
    };
  }

  return {
    ...params,
    action: "update",
    args: {
      where: params.args?.where || params.args,
      data: {
        [field]: createValue(true),
      },
    },
  };
}

export function createDeleteMiddleware(config: ModelConfig): NestedMiddleware {
  return function deleteMiddleware(params, next) {
    return next(createDeleteParams(params, config));
  };
}

/* DeleteMany middleware */

function createDeleteManyParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  if (!params.model) return params;

  const where = params.args?.where || params.args;

  return {
    ...params,
    action: "updateMany",
    args: {
      where: {
        ...where,
        [config.field]: config.createValue(false),
      },
      data: {
        [config.field]: config.createValue(true),
      },
    },
  };
}

export function createDeleteManyMiddleware(
  config: ModelConfig
): NestedMiddleware {
  return function deleteManyMiddleware(params, next) {
    return next(createDeleteManyParams(params, config));
  };
}

/* Update middleware */

function createUpdateParams(
  params: NestedParams,
  config: ModelConfig,
): NestedParams {
  if (
    params.scope?.relations &&
    !params.scope.relations.to.isList &&
    !config.allowToOneUpdates &&
    !params.args?.__passUpdateThrough
  ) {
    throw new Error(
      `prisma-soft-delete-middleware: update of model "${params.model}" through "${params.scope?.parentParams.model}.${params.scope.relations.to.name}" found. Updates of soft deleted models through a toOne relation is not supported as it is possible to update a soft deleted record.`
    );
  }

  // remove __passUpdateThrough from args
  if (params.args?.__passUpdateThrough) {
    delete params.args.__passUpdateThrough;
  }

  return params;
}

export function createUpdateMiddleware(config: ModelConfig): NestedMiddleware {
  return function updateMiddleware(params, next) {
    return next(createUpdateParams(params, config));
  };
}

/* UpdateMany middleware */

function createUpdateManyParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  // do nothing if args are not defined to allow Prisma to throw an error
  if (!params.args) return params;

  return {
    ...params,
    args: {
      ...params.args,
      where: {
        ...params.args?.where,
        // allow overriding the deleted field in where
        [config.field]:
          params.args?.where?.[config.field] || config.createValue(false),
      },
    },
  };
}

export function createUpdateManyMiddleware(
  config: ModelConfig
): NestedMiddleware {
  return function updateManyMiddleware(params, next) {
    return next(createUpdateManyParams(params, config));
  };
}

/* Upsert middleware */

export function createUpsertMiddleware(_: ModelConfig): NestedMiddleware {
  return function upsertMiddleware(params, next) {
    if (params.scope?.relations && !params.scope.relations.to.isList) {
      throw new Error(
        `prisma-soft-delete-middleware: upsert of model "${params.model}" through "${params.scope?.parentParams.model}.${params.scope.relations.to.name}" found. Upserts of soft deleted models through a toOne relation is not supported as it is possible to update a soft deleted record.`
      );
    }

    return next(params);
  };
}

/* FindUnique middleware */

function createFindUniqueParams(
  params: NestedParams,
  config: ModelConfig,
  uniqueFields: string[],
  uniqueIndexFields: string[]
): NestedParams {
  // pass through invalid args so Prisma throws an error
  // findUnique must have a where object
  // where object must have at least one defined unique field
  if (
    !params.args?.where ||
    typeof params.args.where !== "object" ||
    !Object.entries(params.args.where).some(
      ([key, val]) =>
        (uniqueFields.includes(key) || uniqueIndexFields.includes(key)) &&
        typeof val !== "undefined"
    )
  ) {
    return params;
  }


  return {
    ...params,
    action: "findFirst",
    args: {
      ...params.args,
      where: {
        ...params.args?.where,
        [config.field]: config.createValue(false),
      },
    },
  };
}

export function createFindUniqueMiddleware(
  config: ModelConfig
): NestedMiddleware {
  const uniqueFieldsByModel: Record<string, string[]> = {};
  const uniqueIndexFieldsByModel: Record<string, string[]> = {};

  Prisma.dmmf.datamodel.models.forEach((model) => {
    // add unique fields derived from indexes
    const uniqueIndexFields: string[] = [];
    model.uniqueFields.forEach((field) => {
      uniqueIndexFields.push(field.join("_"));
    });
    uniqueIndexFieldsByModel[model.name] = uniqueIndexFields;

    // add id field and unique fields from @unique decorator
    const uniqueFields: string[] = [];
    model.fields.forEach((field) => {
      if (field.isId || field.isUnique) {
        uniqueFields.push(field.name);
      }
    });
    uniqueFieldsByModel[model.name] = uniqueFields;
  });

  return function findUniqueMiddleware(params, next) {
    return next(
      createFindUniqueParams(
        params,
        config,
        uniqueFieldsByModel[params.model || ""] || [],
        uniqueIndexFieldsByModel[params.model || ""] || []
      )
    );
  };
}

/* FindFirst middleware */

function createFindFirstParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  return {
    ...params,
    action: "findFirst",
    args: {
      ...params.args,
      where: {
        ...params.args?.where,
        // allow overriding the deleted field in where
        [config.field]:
          params.args?.where?.[config.field] || config.createValue(false),
      },
    },
  };
}

export function createFindFirstMiddleware(
  config: ModelConfig
): NestedMiddleware {
  return function findFirst(params, next) {
    return next(createFindFirstParams(params, config));
  };
}

/* FindMany middleware */

function createFindManyParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  return {
    ...params,
    action: "findMany",
    args: {
      ...params.args,
      where: {
        ...params.args?.where,
        // allow overriding the deleted field in where
        [config.field]:
          params.args?.where?.[config.field] || config.createValue(false),
      },
    },
  };
}

export function createFindManyMiddleware(
  config: ModelConfig
): NestedMiddleware {
  return function findManyMiddleware(params, next) {
    return next(createFindManyParams(params, config));
  };
}

/* Count middlware */

function createCountParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  const args = params.args || {};
  const where = args.where || {};

  return {
    ...params,
    args: {
      ...args,
      where: {
        ...where,
        // allow overriding the deleted field in where
        [config.field]: where[config.field] || config.createValue(false),
      },
    },
  };
}

export function createCountMiddleware(config: ModelConfig): NestedMiddleware {
  return function countMiddleware(params, next) {
    return next(createCountParams(params, config));
  };
}

/* Aggregate middleware */

function createAggregateParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  const args = params.args || {};
  const where = args.where || {};

  return {
    ...params,
    args: {
      ...args,
      where: {
        ...where,
        // allow overriding the deleted field in where
        [config.field]: where[config.field] || config.createValue(false),
      },
    },
  };
}

export function createAggregateMiddleware(
  config: ModelConfig
): NestedMiddleware {
  return function aggregateMiddleware(params, next) {
    return next(createAggregateParams(params, config));
  };
}

/* Where middleware */

function createWhereParams(params: NestedParams, config: ModelConfig) {
  // customise list queries with every modifier unless the deleted field is set
  if (params.scope?.modifier === "every" && !params.args[config.field]) {
    return {
      ...params,
      args: {
        OR: [
          { [config.field]: { not: config.createValue(false) } },
          params.args,
        ],
      },
    };
  }

  return {
    ...params,
    args: {
      ...params.args,
      [config.field]: params.args[config.field] || config.createValue(false),
    },
  };
}

export function createWhereMiddleware(config: ModelConfig): NestedMiddleware {
  return function whereMiddleware(params, next) {
    if (!params.scope) return next(params);
    return next(createWhereParams(params, config));
  };
}

/* Include middleware */

function createIncludeParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  // includes of toOne relation cannot filter deleted records using params
  // instead ensure that the deleted field is selected and filter the results
  if (params.scope?.relations?.to.isList === false) {
    if (params.args?.select && !params.args?.select[config.field]) {
      return addDeletedToSelect(params, config);
    }

    return params;
  }

  return {
    ...params,
    args: {
      ...params.args,
      where: {
        ...params.args?.where,
        // allow overriding the deleted field in where
        [config.field]:
          params.args?.where?.[config.field] || config.createValue(false),
      },
    },
  };
}

export function createIncludeMiddleware(config: ModelConfig): NestedMiddleware {
  return async function includeMiddleware(params, next) {
    const updatedParams = createIncludeParams(params, config);

    const deletedFieldAdded =
      typeof updatedParams.args === "object" &&
      updatedParams.args?.__deletedFieldAdded;

    if (deletedFieldAdded) {
      delete updatedParams.args.__deletedFieldAdded;
    }

    const result = await next(updatedParams);

    if (shouldFilterDeletedFromReadResult(params, config)) {
      const filteredResults = filterSoftDeletedResults(result, config);

      if (deletedFieldAdded) {
        stripDeletedFieldFromResults(filteredResults, config);
      }

      return filteredResults;
    }

    return result;
  };
}

/* Select middleware */

function createSelectParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  // selects in includes are handled by createIncludeParams
  if (params.scope?.parentParams.action === "include") {
    return params;
  }

  // selects of toOne relation cannot filter deleted records using params
  if (params.scope?.relations?.to.isList === false) {
    if (params.args?.select && !params.args.select[config.field]) {
      return addDeletedToSelect(params, config);
    }

    return params;
  }

  return {
    ...params,
    args: {
      ...params.args,
      where: {
        ...params.args?.where,
        // allow overriding the deleted field in where
        [config.field]:
          params.args?.where?.[config.field] || config.createValue(false),
      },
    },
  };
}

export function createSelectMiddleware(config: ModelConfig): NestedMiddleware {
  return async function selectMiddleware(params, next) {
    const updatedParams = createSelectParams(params, config);

    const deletedFieldAdded =
      typeof updatedParams.args === "object" &&
      updatedParams.args?.__deletedFieldAdded;

    if (deletedFieldAdded) {
      delete updatedParams.args.__deletedFieldAdded;
    }

    const result = await next(updatedParams);

    if (shouldFilterDeletedFromReadResult(params, config)) {
      const filteredResults = filterSoftDeletedResults(result, config);

      if (deletedFieldAdded) {
        stripDeletedFieldFromResults(filteredResults, config);
      }

      return filteredResults;
    }

    return result;
  };
}
