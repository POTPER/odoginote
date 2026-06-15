import { useState } from "react";

export function useQuickSwitcher() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
