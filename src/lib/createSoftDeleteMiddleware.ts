import { Prisma } from "@prisma/client";
import {
  createNestedMiddleware,
  NestedMiddleware,
} from "prisma-nested-middleware";
import {
  noopMiddleware,
  createAggregateMiddleware,
  createCountMiddleware,
  createFindFirstMiddleware,
  createFindManyMiddleware,
  createFindUniqueMiddleware,
  createIncludeMiddleware,
  createSelectMiddleware,
  createUpsertMiddleware,
  createWhereMiddleware,
  createGroupByMiddleware,
} from "./actionMiddleware";

import { Config, ModelConfig } from "./types";

export function createSoftDeleteMiddleware({
  models,
  defaultConfig = {
    field: "deleted",
    createValue: Boolean,
    allowToOneUpdates: false,
  },
}: Config) {
  if (!defaultConfig.field) {
    throw new Error(
      "prisma-soft-delete-middleware: defaultConfig.field is required"
    );
  }
  if (!defaultConfig.createValue) {
    throw new Error(
      "prisma-soft-delete-middleware: defaultConfig.createValue is required"
    );
  }

  const modelConfig: Partial<Record<Prisma.ModelName, ModelConfig>> = {};

  Object.keys(models).forEach((model) => {
    const modelName = model as Prisma.ModelName;
    const config = models[modelName];
    if (config) {
      modelConfig[modelName] =
        typeof config === "boolean" && config ? defaultConfig : config;
    }
  });

  const middlewareByModel = Object.keys(modelConfig).reduce<
    Record<string, Record<string, NestedMiddleware | undefined>>
  >((acc, model) => {
    const config = modelConfig[model as Prisma.ModelName]!;
    return {
      ...acc,
      [model]: {
        delete: noopMiddleware(config),
        deleteMany: noopMiddleware(config),
        update: noopMiddleware(config),
        updateMany: noopMiddleware(config),

        upsert: createUpsertMiddleware(config),
        findFirst: createFindFirstMiddleware(config),
        findUnique: createFindUniqueMiddleware(config),
        findMany: createFindManyMiddleware(config),
        count: createCountMiddleware(config),
        aggregate: createAggregateMiddleware(config),
        where: createWhereMiddleware(config),
        include: createIncludeMiddleware(config),
        select: createSelectMiddleware(config),
        groupBy: createGroupByMiddleware(config),
      },
    };
  }, {});

  // before handling root params generate deleted value so it is consistent
  // for the query. Add it to root params and get it from scope?

  return createNestedMiddleware((params, next) => {
    const middleware = middlewareByModel[params.model || ""]?.[params.action];

    // apply middleware if it is found for model and action
    if (middleware) return middleware(params, next);

    return next(params);
  });
}
