import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test-utils/render";
import { MarkInactiveModal } from "./MarkInactiveModal";

const mockDeactivate = jest.fn();
const mockShow = jest.fn();

jest.mock("@/lib/api/contactsApi", () => ({
  useDeactivateContactMutation: () => [mockDeactivate, { isLoading: false }],
}));
jest.mock("@mantine/notifications", () => ({ notifications: { show: (...args: unknown[]) => mockShow(...args) } }));

const confirmButton = () => screen.getByRole("button", { name: "אישור וסימון" });

async function pickSource(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getAllByLabelText(/מקור הבקשה/)[0]!);
  await user.click(await screen.findByRole("option", { name: label }));
}

async function pickDate(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText(/תאריך הבקשה/), text);
}

describe("MarkInactiveModal", () => {
  const onClose = jest.fn();
  const onDeactivated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeactivate.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  const renderModal = () =>
    render(<MarkInactiveModal opened contactId="c1" onClose={onClose} onDeactivated={onDeactivated} />);

  it("keeps the confirm button disabled until both source and date are chosen (no immediate toggle)", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(confirmButton()).toBeDisabled();

    await pickSource(user, "טלפון");
    expect(confirmButton()).toBeDisabled();
  });

  it("sends the contact id with the documented source and date, then reports success", async () => {
    const user = userEvent.setup();
    renderModal();

    await pickSource(user, 'דוא"ל');
    await pickDate(user, "2026-09-30");
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    await user.click(confirmButton());

    await waitFor(() => expect(onDeactivated).toHaveBeenCalledTimes(1));
    expect(mockDeactivate).toHaveBeenCalledWith({
      id: "c1",
      input: { source: "EMAIL", date: expect.stringContaining("2026-09-30") },
    });
  });

  it("shows an error toast and does not report success when the request fails", async () => {
    mockDeactivate.mockReturnValue({ unwrap: () => Promise.reject(new Error("500")) });
    const user = userEvent.setup();
    renderModal();

    await pickSource(user, "אחר");
    await pickDate(user, "2026-09-30");
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    await user.click(confirmButton());

    await waitFor(() => expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ color: "red" })));
    expect(onDeactivated).not.toHaveBeenCalled();
  });

  it("cancel closes the modal without calling the API", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "ביטול" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockDeactivate).not.toHaveBeenCalled();
  });
});
