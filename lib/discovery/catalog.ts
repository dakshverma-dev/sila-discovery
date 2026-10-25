// Names, addresses and IDs verified against Qloo /search on 25 October 2026.
// These venues have NOT offered or approved the fictional sessions below.
export const venues = [
  {
    id: "printmakers",
    name: "Edinburgh Printmakers",
    qlooId: "A2EA1EF0-4041-4784-825F-D3C7AAF96F00",
    address: "Castle Mills, 1 Dundee Street, Edinburgh",
    art: "bewick.jpg",
  },
  {
    id: "museum",
    name: "National Museum of Scotland",
    qlooId: "36203B6D-C8CF-4784-9612-2D6A149325FA",
    address: "Chambers Street, Edinburgh",
    art: "melencolia.jpg",
  },
  {
    id: "garden",
    name: "Royal Botanic Garden Edinburgh",
    qlooId: "D2FF5BE6-CF16-4C6F-B6C6-BD203D7C8D0F",
    address: "Inverleith Row, Edinburgh",
    art: "actiniae.jpg",
  },
  {
    id: "stills",
    name: "Stills",
    qlooId: "8A1626F3-62AB-4B28-9E4C-6653433FB746",
    address: "23 Cockburn Street, Edinburgh",
    art: "hare.jpg",
  },
  {
    id: "fruitmarket",
    name: "Fruitmarket",
    qlooId: "E47D2895-8282-40B4-86D4-73708B41388A",
    address: "45 Market Street, Edinburgh",
    art: "kentedetail.jpg",
  },
] as const;

export type Session = {
  id: string;
  venueId: string;
  title: string;
  startsAt: string;
  pricePence: number;
  minimum: number;
  remaining: number;
  status: "open" | "cancelled";
  version: number;
};

export const sessions: Session[] = [
  {
    id: "print-room",
    venueId: "printmakers",
    title: "An afternoon in the print room",
    startsAt: "2026-11-19T16:00:00Z",
    pricePence: 4500,
    minimum: 16,
    remaining: 9,
    status: "open",
    version: 1,
  },
  {
    id: "museum-stories",
    venueId: "museum",
    title: "Objects with a thousand stories",
    startsAt: "2026-11-21T14:00:00Z",
    pricePence: 1800,
    minimum: 10,
    remaining: 8,
    status: "open",
    version: 1,
  },
  {
    id: "garden-art",
    venueId: "garden",
    title: "A slower walk through the garden",
    startsAt: "2026-11-22T11:00:00Z",
    pricePence: 2200,
    minimum: 12,
    remaining: 10,
    status: "open",
    version: 1,
  },
  {
    id: "photography",
    venueId: "stills",
    title: "Seeing Edinburgh differently",
    startsAt: "2026-11-20T17:00:00Z",
    pricePence: 3000,
    minimum: 8,
    remaining: 5,
    status: "open",
    version: 1,
  },
  {
    id: "gallery-evening",
    venueId: "fruitmarket",
    title: "An evening of art & conversation",
    startsAt: "2026-11-21T17:00:00Z",
    pricePence: 2500,
    minimum: 10,
    remaining: 9,
    status: "open",
    version: 1,
  },
];

export function venueFor(session: Session) {
  return venues.find((v) => v.id === session.venueId);
}
export const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(pence / 100);
export const sessionDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
