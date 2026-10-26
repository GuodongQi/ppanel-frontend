import { useTranslation } from "react-i18next";

interface BillingProps {
  type: "dashboard" | "payment";
}

// Sponsor billing section disabled — returns null always
export default function Billing(_props: BillingProps) {
  useTranslation("dashboard");
  return null;
}
