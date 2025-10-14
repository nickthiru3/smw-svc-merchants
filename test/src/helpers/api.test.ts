import { apiSuccess, apiError, serializeErr, TApiResponse } from "#src/helpers/api";

const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

afterAll(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe("src/helpers/api", () => {
  test("apiSuccess wraps data with 200 and JSON body by default", () => {
    const res = apiSuccess({ ok: true });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  test("apiSuccess allows custom status code", () => {
    const res = apiSuccess({ created: true }, 201);
    expect(res.statusCode).toBe(201);
  });

  test("apiError builds standardized error body with optional details", () => {
    const res: TApiResponse = apiError(400, "Bad request", { field: "title" });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ error: "Bad request", details: { field: "title" } });
    expect(res.headers["Content-Type"]).toBe("application/json");
  });

  test("serializeErr returns shallow, safe error info", () => {
    const err = new Error("boom");
    (err as any).code = "TestCode";
    const out = serializeErr(err);
    expect(out).toMatchObject({ name: "Error", message: "boom", code: "TestCode" });
    expect(out).not.toHaveProperty("stack");
  });
});
