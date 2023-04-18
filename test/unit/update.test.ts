import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("update", () => {
  it("does not change update action if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify update results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { name: "John" },
    });
    const next = jest.fn(() => Promise.resolve({ id: 1, name: "John" }));

    expect(await middleware(params, next)).toEqual({ id: 1, name: "John" });
  });

  it("throws when trying to update a model configured for soft delete through a toOne relation", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: {
        author: {
          update: {
            email: "test@test.com",
          },
        },
      },
    });

    const next = () => Promise.resolve({});

    await expect(middleware(params, next)).rejects.toThrowError(
      'prisma-soft-delete-middleware: update of model "User" through "Post.author" found. Updates of soft deleted models through a toOne relation is not supported as it is possible to update a soft deleted record.'
    );
  });

  it("does nothing to nested update actions for toOne relations when allowToOneUpdates is true", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
      defaultConfig: {
        field: "deleted",
        createValue: Boolean,
        allowToOneUpdates: true,
      },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: {
        author: {
          update: {
            email: "blah",
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does nothing to nested update actions for toMany relations", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: {
        comments: {
          update: {
            where: {
              id: 2,
            },
            data: {
              content: "content",
            },
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify update when no args are passed", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    // @ts-expect-error - args are required
    const params = createParams("User", "update", undefined);
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("does not modify update when no where is passed", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    // @ts-expect-error - where is required
    const params = createParams("User", "update", {});
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });
});
