import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test-utils/render";
import { ContactForm } from "./ContactForm";

const mockCreate = jest.fn();
const mockShow = jest.fn();

jest.mock("@/lib/api/contactsApi", () => ({
  useCreateContactMutation: () => [mockCreate, { isLoading: false }],
}));
jest.mock("@/lib/api/supportedBodiesApi", () => ({
  useListSupportedBodiesQuery: () => ({
    data: { items: [{ id: "b1", name: "עמותת דוגמה", companyId: "580", isActive: true, domainIds: ["d1"] }] },
    isLoading: false,
  }),
}));
jest.mock("@/lib/api/domainsApi", () => ({
  useListActiveDomainsQuery: () => ({ data: [{ id: "d1", name: "חינוך", isActive: true }] }),
}));
jest.mock("@mantine/notifications", () => ({ notifications: { show: (...args: unknown[]) => mockShow(...args) } }));

const saveButton = () => screen.getByRole("button", { name: "שמירה" });

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/שם פרטי/), "רחל");
  await user.type(screen.getByLabelText(/שם משפחה/), "כהן");
  await user.type(screen.getByLabelText(/ת"ז/), "000000018");
  await user.type(screen.getByLabelText(/תפקיד/), "מנהלת");
  await user.type(screen.getByLabelText(/טלפון/), "0500000000");
  await user.type(screen.getByLabelText(/דוא"ל/, { selector: "input[type=text], input:not([type])" }), "r@example.com");
  await user.click(screen.getAllByLabelText(/גוף נתמך/)[0]!);
  await user.click(await screen.findByRole("option", { name: "עמותת דוגמה" }));
}

describe("ContactForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReturnValue({ unwrap: () => Promise.resolve({ id: "c1" }) });
  });

  it("keeps save disabled while the form is empty", async () => {
    render(<ContactForm />);
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it("shows a validation message for a checksum-invalid ת\"ז as the user types", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/ת"ז/), "123456789");

    expect(await screen.findByText(/מספר ת"ז אינו תקין/)).toBeInTheDocument();
  });

  it("enables save and submits the values once the form is valid, defaulting domains to all of the body's", async () => {
    const onSuccess = jest.fn();
    const user = userEvent.setup();
    render(<ContactForm onSuccess={onSuccess} />);

    await fillValidForm(user);
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        idNumber: "000000018",
        emails: ["r@example.com"],
        supportedBodyId: "b1",
        domainIds: ["d1"],
      }),
    );
  });

  it("shows a server field error under the form and does not call onSuccess", async () => {
    mockCreate.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            error: {
              code: "VALIDATION_ERROR",
              details: [{ field: "domainIds", message: "תחום שנבחר אינו שייך לגוף הנתמך שנבחר" }],
            },
          },
        }),
    });
    const onSuccess = jest.fn();
    const user = userEvent.setup();
    render(<ContactForm onSuccess={onSuccess} />);

    await fillValidForm(user);
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());

    expect(await screen.findByText("תחום שנבחר אינו שייך לגוף הנתמך שנבחר")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockShow).not.toHaveBeenCalled();
  });

  it("shows a retry toast for an unexpected failure and keeps the entered values", async () => {
    mockCreate.mockReturnValue({ unwrap: () => Promise.reject({ status: 500 }) });
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm(user);
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());

    await waitFor(() => expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ color: "red" })));
    expect(screen.getByLabelText(/שם פרטי/)).toHaveValue("רחל");
  });
});
