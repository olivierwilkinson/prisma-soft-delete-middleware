import { set } from "lodash";
import faker from "faker";

import { createSoftDeleteMiddleware } from "../../src";
import { ActionByModel, createParams } from "./utils/createParams";

describe("select", () => {
  it("does not change select params if model is not in the list", async () => {
    const middleware = createSoftDeleteMiddleware({ models: {} });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      select: { comments: true },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });

  it.each([
    "delete",
    "update",
    "upsert",
    "findFirst",
    "findFirstOrThrow",
    "findUnique",
    "findUniqueOrThrow",
    "findMany",
  ] as Array<ActionByModel<"User">>)(
    "can select records for configured models in %s",
    async (action) => {
      const middleware = createSoftDeleteMiddleware({
        models: { User: true },
      });

      const params = createParams("User", action, {
        where: { id: 1 },
        select: {
          comments: true,
        },
      });

      const next = jest.fn(() =>
        Promise.resolve({
          comments: [{ deleted: true }, { deleted: false }],
        })
      );

      await middleware(params, next);

      // @ts-expect-error - ts doesn't know there has been a call
      expect(next.mock.calls[0][0]?.args?.select).toEqual({
        comments: true,
      });
    }
  );

  it("excludes deleted records from selects", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Comment: true },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      select: {
        comments: true,
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have been modified
    expect(next).toHaveBeenCalledWith(
      set(params, "args.select.comments", {
        where: {
          deleted: false,
        },
      })
    );
  });

  it("excludes deleted records from selects using where", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Comment: true },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      select: {
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
      set(params, "args.select.comments.where.deleted", false)
    );
  });

  it("excludes deleted records from include with select", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Comment: true },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      include: {
        comments: {
          select: {
            id: true,
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(
      set(params, "args.include.comments", {
        where: { deleted: false },
        select: { id: true },
      })
    );
  });

  it("allows explicitly selecting deleted records using select", async () => {
    const middleware = createSoftDeleteMiddleware({
      models: { Comment: true },
    });

    const params = createParams("User", "update", {
      where: { id: 1 },
      data: { email: "test@test.com" },
      select: {
        comments: {
          where: {
            deleted: true,
          },
        },
      },
    });
    const next = jest.fn(() => Promise.resolve({}));

    await middleware(params, next);

    // params have not been modified
    expect(next).toHaveBeenCalledWith(params);
  });
});
