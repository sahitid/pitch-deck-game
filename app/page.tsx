import cardsData from "@/cards.json";
import { PitchDeckGame } from "@/components/PitchDeckGame";

export default function Home() {
  return <PitchDeckGame cardsData={cardsData} />;
}
