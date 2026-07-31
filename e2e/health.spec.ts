import { expect, test } from "@playwright/test";

test.describe("health endpoint", () => {
  test("responds with JSON shape", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();

    expect(body).toHaveProperty("ok");
    expect(body).toHaveProperty("service", "golf-ai");
    expect(body).toHaveProperty("db");
    expect(body.db).toHaveProperty("connected");
  });
});
