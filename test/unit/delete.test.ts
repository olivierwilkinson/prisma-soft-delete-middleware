import { set } from "lodash";
import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("delete", () => {
  it("does not change delete action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "delete", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not change nested delete action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        posts: {
          delete: { id: 1 },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify delete results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    const params = createParams("User", "delete", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({ id: 1, deleted: true }));

    expect(await middleware(params, next)).toEqual({ id: 1, deleted: true });
  });

  it("does not modify delete with no args", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    // @ts-expect-error - args are required
    const params = createParams("User", "delete", undefined);
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify delete with no where", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    // @ts-expect-error - where is required
    const params = createParams("User", "delete", {});
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("changes delete action into an update to add deleted mark", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "delete", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve());
    await middleware(params, next);

    // params are modified correctly
    expect(next).toHaveBeenCalledWith({
      ...params,
      action: "update",
      args: {
        ...params.args,
        data: { deleted: true },
      },
    });
  });

  it("does not change nested delete false action", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Profile: true },
    });

    const next = jest.fn(() => Promise.resolve({}));
    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        profile: { delete: false },
      },
    });

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("changes nested delete true action into an update that adds deleted mark", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Profile: true },
    });

    const next = jest.fn(() => Promise.resolve({}));
    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        profile: {
          delete: true,
        },
      },
    });

    await middleware(params, next);

    // params are modified correctly
    expect(next).toHaveBeenCalledWith(
      set(params, "args.data.profile", {
        update: { deleted: true },
      })
    );
  });

  it("changes nested delete action on a toMany relation into an update that adds deleted mark", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Post: true },
    });

    const next = jest.fn(() => Promise.resolve({}));
    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        posts: {
          delete: { id: 1 },
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
            update: {
              where: { id: 1 },
              data: { deleted: true },
            },
          },
        },
      },
    });
  });

  it("changes nested list of delete actions into a nested list of update actions", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Post: true },
    });

    const next = jest.fn(() => Promise.resolve({}));
    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        posts: {
          delete: [{ id: 1 }, { id: 2 }, { id: 3 }],
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
            update: [
              { where: { id: 1 }, data: { deleted: true } },
              { where: { id: 2 }, data: { deleted: true } },
              { where: { id: 3 }, data: { deleted: true } },
            ],
          },
        },
      },
    });
  });
});
