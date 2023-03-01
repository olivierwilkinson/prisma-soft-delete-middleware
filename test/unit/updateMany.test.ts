import { set } from "lodash";
import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("updateMany", () => {
  it("does not change updateMany action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "updateMany", {
      where: { id: { in: [1, 2] } },
      data: { email: "test@test.com" },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify updateMany results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    const params = createParams("User", "updateMany", {
      where: { id: 1 },
      data: { name: "John" },
    });
    const next = jest.fn(() => Promise.resolve({ count: 1 }));

    expect(await middleware(params, next)).toEqual({ count: 1 });
  });

  it("excludes deleted records from root updateMany action", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "updateMany", {
      where: { id: 1 },
      data: { email: "test@test.com" },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        where: {
          ...params.args.where,
          deleted: false,
        },
      },
    });
  });

  it("excludes deleted record from nested updateMany action", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Comment: true },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        comments: {
          updateMany: {
            where: {
              content: "foo",
              OR: [{ authorId: 1 }, { authorId: 2 }],
              AND: [
                { createdAt: { gt: new Date() } },
                { createdAt: { lt: new Date() } },
              ],
              NOT: { content: "bar" },
            },
            data: { content: "bar" },
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(
      set(params, "args.data.comments.updateMany.where.deleted", false)
    );
  });

  it("allows explicitly updating deleted records", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: {
        User: true,
      },
    });

    const params = createParams("User", "updateMany", {
      where: { id: { in: [1, 2] }, deleted: true },
      data: { email: "test@test.com" },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("allows explicitly updating deleted records when using custom deletedAt field", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: {
        User: {
          field: "deletedAt",
          createValue: (deleted) => {
            if (deleted) return new Date();
            return null;
          },
        },
      },
    });

    const params = createParams("User", "updateMany", {
      where: { id: { in: [1, 2] }, deletedAt: { not: null } },
      data: { email: "test@test.com" },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });
});
