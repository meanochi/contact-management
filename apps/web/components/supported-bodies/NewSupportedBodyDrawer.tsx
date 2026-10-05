"use client";

import { useState } from "react";
import { Drawer, Button } from "@mantine/core";
import { SupportedBodyForm } from "./SupportedBodyForm";

// Content direction (UX-DR7): opens from the left, like every other
// content/edit Drawer in this app — not the right-side nav Drawer.
export function NewSupportedBodyDrawer() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Button onClick={() => setOpened(true)}>גוף נתמך חדש</Button>
      <Drawer opened={opened} onClose={() => setOpened(false)} position="left" title="גוף נתמך חדש">
        <SupportedBodyForm onSuccess={() => setOpened(false)} />
      </Drawer>
    </>
  );
}
