import type { Metadata } from "next";

import TripMapExplorer from "@/app/trip/TripMapExplorer";

export const metadata: Metadata = {
  title: "Ride map · Rippers",
  description:
    "Plan where to ride: search a destination, find trails and bike shops, and on Premium build multi-stop trips with hire and service near each leg.",
};

export default function TripPage() {
  return <TripMapExplorer />;
}
