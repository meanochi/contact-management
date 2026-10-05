import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "dayjs/locale/he"; // registers dayjs's Hebrew locale data — DatesProvider's locale:"he" is inert without this
import { ColorSchemeScript, mantineHtmlProps, MantineProvider, DirectionProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { DatesProvider } from "@mantine/dates";
import { theme } from "@contact-management/ui";
import { StoreProvider } from "./StoreProvider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ניהול אנשי קשר",
  description: "ניהול גופים נתמכים ואנשי קשר",
};

// Deliberately thin — Mantine/RTL setup only, nothing screen-specific. The
// AppShell (Sidebar) lives in (internal)/layout.tsx, not here, so a future
// (public) route (the registration form, Epic 2) never gets the internal nav.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <DirectionProvider initialDirection="rtl">
          <MantineProvider theme={theme}>
            {/* firstDayOfWeek: 0 — weeks start Sunday (Israeli convention), not Mantine's Monday default */}
            <DatesProvider settings={{ locale: "he", firstDayOfWeek: 0 }}>
              <Notifications />
              <StoreProvider>{children}</StoreProvider>
            </DatesProvider>
          </MantineProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
