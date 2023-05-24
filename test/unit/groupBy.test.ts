import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("groupBy", () => {

  //group by must always have by and order by, else we get an error,
  it("does not change groupBy action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "groupBy", { where: { id: 1 }, by: ['id'], orderBy: {}, });
    const next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);
    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify groupBy results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });
    const params = createParams("User", "groupBy", { where: { id: 1 }, by: ['id'], orderBy: {}, });
    const next = jest.fn(() => Promise.resolve([{ id: 1, deleted: true }]));
    expect(await middleware(params, next)).toEqual([{ id: 1, deleted: true }]);
  });

  it("excludes deleted records from groupBy", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "groupBy", { where: { id: 1 },by: ['id'],  orderBy: {} });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith({
      ...params,
      action: "groupBy",
      args: {
        by: ['id'],
        orderBy: { },
        where: {
          id: 1,
          deleted: false,
        },
      },
    });
  });


  it("allows explicitly querying for deleted records using groupBy", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "groupBy", {
      where: { id: 1, deleted: true }, by: ['id'],  orderBy: {} 
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });
});
