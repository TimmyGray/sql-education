/**
 * Tests for the generic request<T>() helper, focused on the
 * 401 -> refresh -> retry (single-flight) behavior.
 *
 * The network is fully mocked via global.fetch. We never hit a real server.
 */

import {
  request,
  tokenStore,
  ApiError,
  setAuthFailureHandler,
  setTokenRefreshedHandler,
  API_BASE_URL,
} from "./api-client";

type FetchMock = jest.MockedFunction<typeof fetch>;

/** Build a minimal Response-like object honoring the bits request<T>() reads. */
function makeResponse(
  status: number,
  body?: unknown,
): Response {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => text,
  } as unknown as Response;
}

describe("request() 401 -> refresh -> retry", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    tokenStore.set("old-token");
    fetchMock = jest.fn() as FetchMock;
    global.fetch = fetchMock;
    setAuthFailureHandler(null);
    setTokenRefreshedHandler(null);
  });

  afterEach(() => {
    tokenStore.clear();
    jest.clearAllMocks();
  });

  it("refreshes once on 401, updates the token, and retries the original request", async () => {
    const onRefreshed = jest.fn();
    setTokenRefreshedHandler(onRefreshed);

    fetchMock
      // 1) original request -> 401
      .mockResolvedValueOnce(makeResponse(401, { message: "Unauthorized" }))
      // 2) POST /auth/refresh -> 200 with a new token
      .mockResolvedValueOnce(
        makeResponse(200, {
          accessToken: "new-token",
          tokenType: "Bearer",
          expiresIn: 900,
        }),
      )
      // 3) retried original request -> 200
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));

    const result = await request<{ ok: boolean }>("/protected");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // The refresh call hit /auth/refresh.
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/refresh`);

    // The retry carried the NEW bearer token.
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    const retryHeaders = retryInit.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe("Bearer new-token");

    // Token store + listener were updated.
    expect(tokenStore.get()).toBe("new-token");
    expect(onRefreshed).toHaveBeenCalledWith("new-token");
  });

  it("clears auth and propagates the 401 when refresh fails", async () => {
    const onFailure = jest.fn();
    setAuthFailureHandler(onFailure);

    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { message: "Unauthorized" }))
      // refresh fails
      .mockResolvedValueOnce(makeResponse(401, { message: "no cookie" }));

    await expect(request("/protected")).rejects.toBeInstanceOf(ApiError);
    expect(onFailure).toHaveBeenCalledTimes(1);
    // Only original + refresh attempts; no retry.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent 401s into a single refresh (single-flight)", async () => {
    let refreshCalls = 0;

    fetchMock.mockImplementation(((url: string) => {
      if (url === `${API_BASE_URL}/auth/refresh`) {
        refreshCalls += 1;
        return Promise.resolve(
          makeResponse(200, {
            accessToken: "fresh",
            tokenType: "Bearer",
            expiresIn: 900,
          }),
        );
      }
      // Any protected call: 401 with the stale token, 200 once refreshed.
      return Promise.resolve(
        tokenStore.get() === "fresh"
          ? makeResponse(200, { ok: true })
          : makeResponse(401, { message: "Unauthorized" }),
      );
    }) as typeof fetch);

    const [a, b, c] = await Promise.all([
      request<{ ok: boolean }>("/a"),
      request<{ ok: boolean }>("/b"),
      request<{ ok: boolean }>("/c"),
    ]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(c).toEqual({ ok: true });
    // Despite three concurrent 401s, refresh ran exactly once.
    expect(refreshCalls).toBe(1);
  });

  it("does not attempt refresh when the caller opts out of auth (accessToken: null)", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(401, { message: "Unauthorized" }),
    );

    await expect(
      request("/auth/refresh", { method: "POST", accessToken: null }),
    ).rejects.toBeInstanceOf(ApiError);

    // No second (refresh) call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
