import type { Area, Occasion } from "./types";

export const OCCASIONS: Record<
  Occasion,
  {
    label: string;
    emoji: string;
    blurb: string;
    /** Primary genres allowed (suffix after urn:tag:genre:place:restaurant). Empty string = generic restaurant. */
    allow: (genreId: string) => boolean;
    boost: string[];
    penalty: string[];
  }
> = {
  date: {
    label: "Date night",
    emoji: "🕯️",
    blurb: "Somewhere you can actually talk",
    allow: (g) => isMeal(g),
    boost: ["Date night", "Romantic", "Intimate", "Cozy", "Anniversary", "Special occasion", "Candlelit", "Quiet", "Charming"],
    penalty: ["Loud", "Counter service", "Fast food"],
  },
  friends: {
    label: "Catch-up",
    emoji: "🥂",
    blurb: "Lively, shareable, no fuss",
    allow: (g) => isMeal(g) || g.endsWith(":bar") || g.endsWith(":brewpub"),
    boost: ["Groups of friends", "Lively", "Casual", "Good for Groups", "Large Group", "Social", "Fun", "Late night", "Shareable"],
    penalty: ["Formal"],
  },
  business: {
    label: "Work meal",
    emoji: "💼",
    blurb: "Quiet enough to close the deal",
    allow: (g) => isMeal(g),
    boost: ["Work dinner", "Business meeting", "Quiet", "Upscale", "Professional", "Wi fi", "Reservations"],
    penalty: ["Loud", "Late night food"],
  },
  show: {
    label: "Before a show",
    emoji: "🎟️",
    blurb: "Dinner near the venue, before doors",
    allow: (g) => isMeal(g),
    boost: ["Pre theater", "Quick bite", "Lively", "Casual", "Fast service", "Groups of friends", "Date night"],
    penalty: ["Reservations required", "Tasting menu"],
  },
  coffee: {
    label: "Coffee or dessert",
    emoji: "☕",
    blurb: "Low-stakes first meetups",
    allow: (g) => g.startsWith("urn:tag:genre:place:restaurant") && isCafe(g),
    boost: ["Cozy", "Wi fi", "Quiet", "Charming", "Study", "Welcoming"],
    penalty: [],
  },
};

const CAFE_TOKENS = new Set(["cafe", "coffee", "tea", "bakery", "dessert", "cupcake", "donut", "doughnut", "pastry", "patisserie", "ice", "gelato", "yogurt", "juice", "smoothie", "boba", "chocolate", "candy", "brunch", "creamery"]);
const BAR_TOKENS = new Set(["bar", "pub", "club", "lounge", "brewery", "winery", "nightclub"]);
const FOOD_BAR_TOKENS = new Set(["sushi", "oyster", "raw", "tapas", "noodle", "ramen", "salad"]);

function tokens(genreId: string) {
  return (genreId.split(":").pop() ?? "").split("_");
}

function isCafe(genreId: string) {
  return tokens(genreId).some((t) => CAFE_TOKENS.has(t));
}

function isMeal(genreId: string) {
  if (!genreId.startsWith("urn:tag:genre:place:restaurant")) return false;
  const ts = tokens(genreId);
  const barOnly = ts.some((t) => BAR_TOKENS.has(t)) && !ts.some((t) => FOOD_BAR_TOKENS.has(t));
  return !isCafe(genreId) && !barOnly;
}

export const AREAS: Area[] = [
  { id: "downtown-berkeley", label: "Downtown Berkeley", lat: 37.8715, lon: -122.2681, radius: 1600 },
  { id: "north-berkeley", label: "North Berkeley", lat: 37.8796, lon: -122.2689, radius: 1300 },
  { id: "elmwood", label: "Elmwood & College Ave", lat: 37.8586, lon: -122.2531, radius: 1300 },
  { id: "rockridge", label: "Rockridge", lat: 37.8443, lon: -122.2512, radius: 1300 },
  { id: "temescal", label: "Temescal, Oakland", lat: 37.8331, lon: -122.2627, radius: 1300 },
];

export const DEFAULT_AREA: Area = AREAS[0]!;

export const VENUES: Area[] = [
  { id: "greek-theatre", label: "the Greek Theatre", lat: 37.8735, lon: -122.2541, radius: 1800 },
  { id: "uc-theatre", label: "The UC Theatre", lat: 37.8718, lon: -122.2698, radius: 1300 },
  { id: "freight", label: "Freight & Salvage", lat: 37.8712, lon: -122.2693, radius: 1300 },
  { id: "fox-oakland", label: "the Fox Theater, Oakland", lat: 37.8079, lon: -122.27, radius: 1400 },
];

export const DEFAULT_VENUE: Area = VENUES[0]!;
