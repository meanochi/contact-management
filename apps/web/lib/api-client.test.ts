import { apiFetch } from "./api-client";

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

describe("apiFetch", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("calls the API base URL with the path and forwards init options", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await apiFetch("/contacts?page=1", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/contacts?page=1", { method: "POST" });
  });

  it("returns the parsed JSON body on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: "c1" }] }));
    await expect(apiFetch("/contacts")).resolves.toEqual({ data: [{ id: "c1" }] });
  });

  it("throws the API's own error message from the error envelope", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "NOT_FOUND", message: "איש קשר לא נמצא" } }, 404));
    await expect(apiFetch("/contacts/x")).rejects.toThrow("איש קשר לא נמצא");
  });

  it("falls back to a generic message with path and status when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    } as unknown as Response);
    await expect(apiFetch("/contacts")).rejects.toThrow("הבקשה לשרת נכשלה (קוד 502)");
  });

  it("falls back to the generic message when the envelope has no message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    await expect(apiFetch("/contacts")).rejects.toThrow("הבקשה לשרת נכשלה (קוד 500)");
  });
});
