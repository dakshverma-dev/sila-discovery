import type { Metadata } from "next";
import { ProductTour } from "@/components/sila/tour/product-tour";

export const metadata: Metadata = { title: "Sila for cultural venues · product tour", description: "Explore a fictional shared booking from venue publication to club commitment, direct venue payments and confirmation." };
export default function TourPage() { return <ProductTour />; }
