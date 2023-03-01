import { set } from "lodash";
import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("aggregate", () => {
  it("does not change aggregate action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "aggregate", {
      where: { email: { contains: "test" } },
      _sum: { id: true },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("excludes deleted records from aggregate with no where", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "aggregate", {});
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(set(params, "args.where.deleted", false));
  });

  it("excludes deleted record from aggregate with where", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "aggregate", {
      where: { email: { contains: "test" } },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(set(params, "args.where.deleted", false));
  });
});
