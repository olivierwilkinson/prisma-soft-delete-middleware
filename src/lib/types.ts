import { Prisma } from "@prisma/client";
import { NestedAction, NestedParams } from "prisma-nested-middleware";

export type ModelConfig = {
  field: string;
  createValue: (deleted: boolean) => any;
  allowToOneUpdates?: boolean;
};

export type Config = {
  models: Partial<Record<Prisma.ModelName, ModelConfig | boolean>>;
  defaultConfig?: ModelConfig;
};
//extended like this so we didnt have to make a PR directly to prisma. NestedAction dont contains groupBy
export type NestedCustomParams = Omit<NestedParams, "action"> & {action: NestedAction | "groupBy"}