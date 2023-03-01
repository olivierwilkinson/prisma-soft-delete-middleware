import { set } from "lodash";
import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("count", () => {
  it("does not change count action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "count", {});
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("excludes deleted records from count", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "count", undefined);
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(set(params, "args.where.deleted", false));
  });

  it("excludes deleted records from count with empty args", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "count", {});
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(set(params, "args.where.deleted", false));
  });

  it("excludes deleted record from count with where", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "count", {
      where: { email: { contains: "test" } },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(set(params, "args.where.deleted", false));
  });
});
