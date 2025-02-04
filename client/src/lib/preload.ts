import * as Dialog from "@radix-ui/react-dialog";
import * as Drawer from "vaul";
import * as Toast from "@radix-ui/react-toast";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Slot from "@radix-ui/react-slot";

// Preload essential Radix UI components
export const preloadComponents = () => {
  // Trigger webpack/vite to include these in the main bundle
  const components = {
    Dialog,
    Drawer,
    Toast,
    AlertDialog,
    Slot,
  };
  return components;
};
