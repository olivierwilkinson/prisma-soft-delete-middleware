import faker from "faker";
import { set } from "lodash";

import { createSoftDeleteMiddleware } from "../../src";
import { createParams } from "./utils/createParams";

describe("config", () => {
  it('does not soft delete models where config is passed as "false"', async () => {
    const middleware = createSoftDeleteMiddleware({
      models: {
        User: false,
      },
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: {
        author: { delete: true },
        comments: {
          updateMany: {
            where: { content: faker.lorem.sentence() },
            data: { content: faker.lorem.sentence() },
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
  });

  it("allows setting default config values", async () => {
    const deletedAt = new Date();
    const middleware = createSoftDeleteMiddleware({
      models: {
        Post: true,
        Comment: true,
      },
      defaultConfig: {
        field: "deletedAt",
        createValue: () => deletedAt,
      },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        posts: {
          delete: { id: 1 },
        },
        comments: {
          updateMany: {
            where: { content: faker.lorem.sentence() },
            data: { content: faker.lorem.sentence() },
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    set(params, "args.data.posts", {
      update: { where: { id: 1 }, data: { deletedAt } },
    });
    set(params, "args.data.comments.updateMany.where.deletedAt", deletedAt);

    expect(next).toHaveBeenCalledWith(params);
  });

  it('throws when default config does not have a "field" property', () => {
    expect(() => {
      createSoftDeleteMiddleware({
        models: {
          Post: true,
        },
        // @ts-expect-error - we are testing the error case
        defaultConfig: {
          createValue: () => new Date(),
        },
      });
    }).toThrowError(
      "prisma-soft-delete-middleware: defaultConfig.field is required"
    );
  });

  it('throws when default config does not have a "createValue" property', () => {
    expect(() => {
      createSoftDeleteMiddleware({
        models: {
          Post: true,
        },
        // @ts-expect-error - we are testing the error case
        defaultConfig: {
          field: "deletedAt",
        },
      });
    }).toThrowError(
      "prisma-soft-delete-middleware: defaultConfig.createValue is required"
    );
  });

  it("allows setting model specific config values", async () => {
    const deletedAt = new Date();
    const middleware = createSoftDeleteMiddleware({
      models: {
        Post: {
          field: "deletedAt",
          createValue: () => deletedAt,
        },
        Comment: true,
      },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        posts: { delete: { id: 1 } },
        comments: {
          updateMany: {
            where: { content: faker.lorem.sentence() },
            data: { content: faker.lorem.sentence() },
          },
        },
      },
    });

    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    set(params, "args.data.posts", {
      update: { where: { id: 1 }, data: { deletedAt } },
    });
    set(params, "args.data.comments.updateMany.where.deleted", false);

    expect(next).toHaveBeenCalledWith(params);
  });

  it("allows overriding default config values", async () => {
    const deletedAt = new Date();
    const middleware = createSoftDeleteMiddleware({
      models: {
        Post: true,
        Comment: {
          field: "deleted",
          createValue: Boolean,
        },
      },
      defaultConfig: {
        field: "deletedAt",
        createValue: (deleted) => {
          if (deleted) return deletedAt;
          return null;
        },
      },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: {
        posts: { delete: { id: 1 } },
        comments: {
          updateMany: {
            where: { content: faker.lorem.sentence() },
            data: { content: faker.lorem.sentence() },
          },
        },
      },
    });

    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    set(params, "args.data.posts", {
      update: { where: { id: 1 }, data: { deletedAt } },
    });
    set(params, "args.data.comments.updateMany.where.deleted", false);

    expect(next).toHaveBeenCalledWith(params);
  });
});
