import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("deleteMany", () => {
  it("does not change deleteMany action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "deleteMany", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not change nested deleteMany action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        posts: {
          deleteMany: {
            id: 1,
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify deleteMany results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    const params = createParams("User", "deleteMany", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({ count: 1 }));

    expect(await middleware(params, next)).toEqual({ count: 1 });
  });

  it("changes deleteMany action into an updateMany that adds deleted mark", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const next = jest.fn(() => Promise.resolve({}));
    const params = createParams("User", "deleteMany", { where: { id: 1 } });
    await middleware(params, next);

    // params are modified correctly
    expect(next).toHaveBeenCalledWith({
      ...params,
      action: "updateMany",
      args: {
        where: { ...params.args.where, deleted: false },
        data: { deleted: true },
      },
    });
  });

  it("changes nested deleteMany action into an updateMany that adds deleted mark", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Post: true },
    });

    const next = jest.fn(() => Promise.resolve({}));
    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        posts: {
          deleteMany: {
            id: 1,
          },
        },
      },
    });

    await middleware(params, next);

    // params are modified correctly
    expect(next).toHaveBeenCalledWith({
      ...params,
      action: "update",
      args: {
        ...params.args,
        data: {
          posts: {
            updateMany: {
              where: { id: 1, deleted: false },
              data: { deleted: true },
            },
          },
        },
      },
    });
  });
});
