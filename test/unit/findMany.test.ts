import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("findMany", () => {
  it("does not change findMany params if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "findMany", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify findMany results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    const params = createParams("User", "findMany", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve([{ id: 1, deleted: true }]));

    expect(await middleware(params, next)).toEqual([{ id: 1, deleted: true }]);
  });

  it("excludes deleted records from findMany", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findMany", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith({
      ...params,
      action: "findMany",
      args: {
        where: {
          id: 1,
          deleted: false,
        },
      },
    });
  });

  it("excludes deleted records from findMany with no args", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findMany", undefined);
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith({
      ...params,
      action: "findMany",
      args: {
        where: {
          deleted: false,
        },
      },
    });
  });

  it("excludes deleted records from findMany with empty args", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findMany", {});
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith({
      ...params,
      action: "findMany",
      args: {
        where: {
          deleted: false,
        },
      },
    });
  });

  it("allows explicitly querying for deleted records using findMany", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findMany", {
      where: { id: 1, deleted: true },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("allows explicitly querying for deleted records using OR modifier", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findMany", {
      where: { id: 1, OR: [{ deleted: true }, { name: 'name' }] },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  })

  it("allows explicitly querying for deleted records using nested OR modifier", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findMany", {
      where: { id: 1, OR: [{ name: 'name' }, { OR: [{ deleted: { not: false } }] }] },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  })

  it("allows explicitly querying for deleted records using AND modifier", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findMany", {
      where: { id: 1, AND: [{ deleted: true }, { name: 'name' }] },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  })

  it("allows explicitly querying for deleted records using nested AND modifier", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findMany", {
      where: { id: 1, AND: [{ name: 'name' }, { OR: [{ deleted: { not: false } }] }] },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  })
});
