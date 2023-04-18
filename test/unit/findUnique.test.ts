import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("findUnique", () => {
  it("does not change findUnique params if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "findUnique", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify findUnique results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    const params = createParams("User", "findUnique", { where: { id: 1 } });
    const next = jest.fn(() => Promise.resolve({ id: 1, deleted: true }));

    expect(await middleware(params, next)).toEqual({ id: 1, deleted: true });
  });

  it("changes findUnique into findFirst and excludes deleted records", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findUnique", { where: { id: 1 } });
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

  it("does not modify findUnique to be a findFirst when no args passed", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    // @ts-expect-error testing if user doesn't pass args accidentally
    const params = createParams("User", "findUnique", undefined);
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify findUnique to be a findFirst when no where passed", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    // @ts-expect-error testing if user doesn't pass where accidentally
    const params = createParams("User", "findUnique", {});
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });
});
