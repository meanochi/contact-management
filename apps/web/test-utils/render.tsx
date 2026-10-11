import type { ReactElement } from "react";
import { render as rtlRender } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { theme } from "@contact-management/ui";

// The one render every component test uses (expertise-testing §2) — never
// `render` straight from @testing-library/react for Mantine components.
export function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <MantineProvider theme={theme} env="test">
        <DatesProvider settings={{ locale: "he", firstDayOfWeek: 0 }}>{children}</DatesProvider>
      </MantineProvider>
    ),
  });
}

export * from "@testing-library/react";
