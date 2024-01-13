import { set } from "lodash";
import faker from "faker";

import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("include", () => {
  it("does not change include params if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      include: { comments: true },
    });

    const next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it("uses params to exclude deleted records from toMany includes", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Comment: true },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      include: {
        comments: true,
      },
    });

    const next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(
      set(params, "args.include.comments", {
        where: {
          deleted: false,
        },
      })
    );
  });

  it("uses params to exclude deleted records from toMany includes with where", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Comment: true },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      include: {
        comments: {
          where: {
            content: faker.lorem.sentence(),
          },
        },
      },
    });

    const next = jest.fn(() => Promise.resolve({}));
    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(
      set(params, "args.include.comments.where.deleted", false)
    );
  });

  it("manually excludes deleted records from boolean toOne include", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: { content: "foo" },
      include: {
        author: true,
      },
    });

    const next = jest.fn(() => Promise.resolve({ author: { deleted: true } }));
    const result = await middleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
    expect(result).toEqual({ author: null });
  });

  it("does not manually exclude non-deleted records from boolean toOne include", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: { content: "foo" },
      include: {
        author: true,
      },
    });

    const next = jest.fn(() => Promise.resolve({ author: { deleted: false } }));
    const result = await middleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
    expect(result).toEqual({ author: { deleted: false } });
  });

  it("manually excludes deleted records from toOne include with nested includes", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: { content: "foo" },
      include: {
        author: {
          include: {
            comments: true,
          },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({ author: { deleted: true, comments: [] } })
    );
    const result = await middleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
    expect(result).toEqual({ author: null });
  });
  
  it("does not manually exclude non-deleted records from toOne include with nested includes", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: { content: "foo" },
      include: {
        author: {
          include: {
            comments: true,
          },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        author: {
          deleted: false,
          comments: [],
        },
      })
    );

    const result = await middleware(params, next);

    expect(result).toEqual({
      author: {
        deleted: false,
        comments: [],
      },
    });
  });

  it("manually excludes deleted records from toOne include nested in toMany include", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { User: true },
    });

    const params = createParams("User", "findFirst", {
      where: { id: 1, deleted: false },
      include: {
        posts: {
          include: {
            author: true,
          },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        posts: [
          { author: null },
          { author: { deleted: true } },
          { author: { deleted: false } },
        ],
      })
    );

    const result = await middleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
    expect(result).toEqual({
      posts: [
        { author: null },
        { author: null },
        { author: { deleted: false } },
      ],
    });
  });


  it("allows explicitly including deleted records using include", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Comment: true },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      include: {
        comments: {
          where: {
            deleted: true,
          },
        },
      },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        comments: [{ deleted: true }, { deleted: true }],
      })
    );

    const result = await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
    expect(result).toEqual({
      comments: [{ deleted: true }, { deleted: true }],
    });
  });
});
