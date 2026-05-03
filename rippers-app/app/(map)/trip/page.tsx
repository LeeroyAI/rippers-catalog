import type { Metadata } from "next";

import TripMapExplorer from "@/app/trip/TripMapExplorer";

export const metadata: Metadata = {
  title: "Ride map · Rippers",
  description: "Search where to ride and find shops tuned to your rider profile.",
};

export default function TripPage() {
  return <TripMapExplorer />;
}
