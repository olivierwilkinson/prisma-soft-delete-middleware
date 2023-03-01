import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("findFirst", () => {
  it("does not change findFirst params if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "findFirst", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify findFirst results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    const params = createParams("User", "findFirst", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({ id: 1, deleted: true }));

    expect(await middleware(params, next)).toEqual({ id: 1, deleted: true });
  });

  it("excludes deleted records from findFirst", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findFirst", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith({
      ...params,
      action: "findFirst",
      args: {
        where: {
          id: 1,
          deleted: false,
        },
      },
    });
  });

  it("allows explicitly querying for deleted records using findFirst", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findFirst", {
      where: { id: 1, deleted: true },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });
});
