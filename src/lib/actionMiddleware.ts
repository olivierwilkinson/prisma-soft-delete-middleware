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
  config: ModelConfig
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

/* FindUnique middleware helpers */

function validateFindUniqueParams(
  params: NestedParams,
  config: ModelConfig
): void {
  const uniqueIndexFields = uniqueIndexFieldsByModel[params.model || ""] || [];
  const uniqueIndexField = Object.keys(params.args?.where || {}).find((key) =>
    uniqueIndexFields.includes(key)
  );

  // when unique index field is found it is not possible to use findFirst.
  // Instead warn the user that soft-deleted models will not be excluded from
  // this query unless warnForUniqueIndexes is false.
  if (uniqueIndexField && !config.allowCompoundUniqueIndexWhere) {
    throw new Error(
      `prisma-soft-delete-middleware: query of model "${params.model}" through compound unique index field "${uniqueIndexField}" found. Queries of soft deleted models through a unique index are not supported. Set "allowCompoundUniqueIndexWhere" to true to override this behaviour.`
    );
  }
}

function shouldPassFindUniqueParamsThrough(
  params: NestedParams,
  config: ModelConfig
): boolean {
  const uniqueFields = uniqueFieldsByModel[params.model || ""] || [];
  const uniqueIndexFields = uniqueIndexFieldsByModel[params.model || ""] || [];
  const uniqueIndexField = Object.keys(params.args?.where || {}).find((key) =>
    uniqueIndexFields.includes(key)
  );

  // pass through invalid args so Prisma throws an error
  return (
    // findUnique must have a where object
    !params.args?.where ||
    typeof params.args.where !== "object" ||
    // where object must have at least one defined unique field
    !Object.entries(params.args.where).some(
      ([key, val]) =>
        (uniqueFields.includes(key) || uniqueIndexFields.includes(key)) &&
        typeof val !== "undefined"
    ) ||
    // pass through if where object has a unique index field and allowCompoundUniqueIndexWhere is true
    !!(uniqueIndexField && config.allowCompoundUniqueIndexWhere)
  );
}

/* FindUnique middleware */

function createFindUniqueParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  if (shouldPassFindUniqueParamsThrough(params, config)) {
    return params;
  }

  validateFindUniqueParams(params, config);

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
  return function findUniqueMiddleware(params, next) {
    return next(createFindUniqueParams(params, config));
  };
}

/* FindUniqueOrThrow middleware */

function createFindUniqueOrThrowParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  if (shouldPassFindUniqueParamsThrough(params, config)) {
    return params;
  }

  validateFindUniqueParams(params, config);

  return {
    ...params,
    action: "findFirstOrThrow",
    args: {
      ...params.args,
      where: {
        ...params.args?.where,
        [config.field]: config.createValue(false),
      },
    },
  };
}

export function createFindUniqueOrThrowMiddleware(
  config: ModelConfig
): NestedMiddleware {
  return function findUniqueMiddleware(params, next) {
    return next(createFindUniqueOrThrowParams(params, config));
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

/* FindFirst middleware */

function createFindFirstOrThrowParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  return {
    ...params,
    action: "findFirstOrThrow",
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

export function createFindFirstOrThrowMiddleware(
  config: ModelConfig
): NestedMiddleware {
  return function findFirstOrThrow(params, next) {
    return next(createFindFirstOrThrowParams(params, config));
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

/*GroupBy middleware */
function createGroupByParams(
  params: NestedParams,
  config: ModelConfig
): NestedParams {
  return {
    ...params,
    action: "groupBy",
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

export function createGroupByMiddleware(config: ModelConfig): NestedMiddleware {
  return function groupByMiddleware(params, next) {
    return next(createGroupByParams(params, config));
  };
}

/* Count middleware */

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
