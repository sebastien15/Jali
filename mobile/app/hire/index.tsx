import Screen from "@/features/driver-hire/screens/HireSearchScreen";
import { ServiceGate } from "@/core/navigation/components/ServiceGate";

/** New-request entry: gated on the service being available (S23.2) */
export default function Route() {
  return <ServiceGate service="hire"><Screen /></ServiceGate>;
}
