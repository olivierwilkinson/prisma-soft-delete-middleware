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

  it("does not modify findUnique to be a findFirst when invalid where passed", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    // @ts-expect-error testing if user doesn't pass where accidentally
    let params = createParams("User", "findUnique", {});
    let next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);
    expect(next).toHaveBeenCalledWith(params);

    // expect empty where not to modify params
    params = createParams("User", "findUnique", { where: {} });
    next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);
    expect(next).toHaveBeenCalledWith(params);

    // expect where with undefined id field not to modify params
    params = createParams("User", "findUnique", { where: { id: undefined } });
    next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);
    expect(next).toHaveBeenCalledWith(params);

    // expect where with undefined unique field not to modify params
    params = createParams("User", "findUnique", {
      where: { email: undefined },
    });
    next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);
    expect(next).toHaveBeenCalledWith(params);

    // expect where with undefined unique index field not to modify params
    params = createParams("User", "findUnique", {
      where: { name_email: undefined },
    });
    next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);
    expect(next).toHaveBeenCalledWith(params);

    // expect where with defined non-unique field
    params = createParams("User", "findUnique", {
      // @ts-expect-error intentionally incorrect where
      where: { name: "test" },
    });
    next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);
    expect(next).toHaveBeenCalledWith(params);

    // expect where with defined non-unique field and undefined id field not to modify params
    params = createParams("User", "findUnique", {
      // @ts-expect-error intentionally incorrect where
      where: { id: undefined, name: "test" },
    });
    next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);
    expect(next).toHaveBeenCalledWith(params);
  });
});
