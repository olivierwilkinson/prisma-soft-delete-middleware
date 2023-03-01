import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("upsert", () => {
  it("does not modify upsert results", async () => {
    const middleware = createSoftDeleteMiddleware({ models: { User: true } });

    const params = createParams("User", "upsert", {
      where: { id: 1 },
      create: { name: "John", email: "John@test.com" },
      update: { name: "John" },
    });
    const next = jest.fn(() =>
      Promise.resolve({ id: 1, name: "John", email: "John@test.com" })
    );

    expect(await middleware(params, next)).toEqual({
      id: 1,
      name: "John",
      email: "John@test.com",
    });
  });

  it("does nothing to root upsert action", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "upsert", {
      where: { id: 1 },
      create: { name: "John", email: "john@test.com" },
      update: { name: "John" },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
  });

  it("does nothing to nested toMany upsert actions", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: {
        comments: {
          upsert: {
            where: { id: 1 },
            create: { content: "Hello", authorId: 1 },
            update: { content: "Hello" },
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
  });

  it("throws when trying to upsert a model configured for soft delete through a toOne relation", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: {
        author: {
          upsert: {
            create: {
              name: "test",
              email: "test@test.com",
            },
            update: {
              email: "test@test.com",
            },
          },
        },
      },
    });

    const next = () => Promise.resolve({});

    await expect(middleware(params, next)).rejects.toThrowError(
      'prisma-soft-delete-middleware: upsert of model "User" through "Post.author" found. Upserts of soft deleted models through a toOne relation is not supported as it is possible to update a soft deleted record.'
    );
  });
});
