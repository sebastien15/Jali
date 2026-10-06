import Screen from "@/features/rentals/screens/RentalCarScreen";
import { ServiceGate } from "@/core/navigation/components/ServiceGate";

/** New-request entry: gated on the service being available (S23.2) */
export default function Route() {
  return <ServiceGate service="rental"><Screen /></ServiceGate>;
}
