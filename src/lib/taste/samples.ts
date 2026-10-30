import type { Occasion, Person } from "./types";

/** Clearly fictional demo people. Their favorites (and places they have been) are real Qloo entities, so every demo run hits the live API. */
export interface SampleDuo {
  id: string;
  title: string;
  story: string;
  occasion: Occasion;
  vibe: string;
  areaId: string;
  priceMax: 1 | 2 | 3 | 4 | null;
  a: Person;
  b: Person;
}

export const SAMPLE_DUOS: SampleDuo[] = [
  {
    id: "maya-leo",
    title: "Maya & Leo",
    story: "A literary romantic and a sci-fi purist on a third date",
    occasion: "date",
    vibe: "cozy, not too loud",
    areaId: "downtown-berkeley",
    priceMax: 3,
    a:
    {
      name: "Maya",
      beenTo: [{ id: "74018DD4-A14F-4AB3-9859-55F140F1DA20", name: "Cheese Board Collective Pizzeria" }, { id: "44DE55E3-FC5E-4E5F-A8EF-1476C4EDEBF6", name: "Grégoire Restaurant" }],
      interests: [
      { id: "4BBEF799-A0C4-4110-AB01-39216993C312", name: "Taylor Swift", kind: "artist" },
      { id: "A1407445-5676-4874-B796-3D81FDA62468", name: "Pride & Prejudice", kind: "movie", year: 2005 },
      { id: "4C60FF74-A236-4488-8FB3-2FE43D1C79FB", name: "Gilmore Girls", kind: "tv_show", year: 2000 },
      { id: "AFBC71A7-9439-4AB0-AB68-D14B11AAF836", name: "Phoebe Bridgers", kind: "artist" },
      ],
    },
    b:
    {
      name: "Leo",
      beenTo: [{ id: "CC1EE8C2-36E1-4DEE-B448-3D63D15D4913", name: "Jupiter" }, { id: "7E7BDFC3-3E29-46AC-B37C-024C5EF3A6D9", name: "Angeline's Louisiana Kitchen" }],
      interests: [
      { id: "C915A918-39C5-47A3-A101-D9FA1DECBD9C", name: "Kendrick Lamar", kind: "artist" },
      { id: "878A5D45-469C-4556-8494-963C2B1D3A95", name: "Dune: Part Two", kind: "movie", year: 2024 },
      { id: "4C305B2F-5A46-4885-A6DA-5E22D11E86E0", name: "The Bear", kind: "tv_show", year: 2022 },
      { id: "2B134C93-39EB-4A08-A72D-5F8F1167FDAA", name: "Frank Ocean", kind: "artist" },
      ],
    },
  },
  {
    id: "priya-sam",
    title: "Priya & Sam",
    story: "New lab partners grabbing their first coffee",
    occasion: "coffee",
    vibe: "somewhere we can actually talk",
    areaId: "north-berkeley",
    priceMax: 2,
    a:
    {
      name: "Priya",
      interests: [
      { id: "9B33A620-68CA-49B3-BFCF-F09CCF8AD595", name: "Spirited Away", kind: "movie", year: 2001 },
      { id: "7D903E2F-70AB-44CB-AA88-82501E6D04DD", name: "Hozier", kind: "artist" },
      { id: "D2BC4814-6C05-4D98-94C9-EC9DF18F5D85", name: "The Great British Baking Show", kind: "tv_show", year: 2010 },
      { id: "C1DADF8A-3FD1-473E-A359-07D20C98181C", name: "Little Women", kind: "book", year: 1868 },
      ],
    },
    b:
    {
      name: "Sam",
      interests: [
      { id: "E3CF515E-C3EA-46DF-92DD-64A0DC360C90", name: "Arctic Monkeys", kind: "artist" },
      { id: "057DA9D9-399B-437E-8BCA-A80E499125EF", name: "Interstellar", kind: "movie", year: 2014 },
      { id: "E5AE1F26-04CB-4CDD-BBA4-87FB6541F848", name: "The Office", kind: "tv_show", year: 2005 },
      { id: "7B75291D-103B-476A-91B5-81E7687D6A59", name: "Project Hail Mary", kind: "book", year: 2021 },
      ],
    },
  },
  {
    id: "dana-omar",
    title: "Dana & Omar",
    story: "A founder pitching an investor over lunch",
    occasion: "business",
    vibe: "impressive but not stuffy",
    areaId: "downtown-berkeley",
    priceMax: 4,
    a:
    {
      name: "Dana",
      interests: [
      { id: "65EAC55F-6FDC-452D-A633-A9E9F2BBD45E", name: "Succession", kind: "tv_show", year: 2018 },
      { id: "F6754C46-B3E7-457F-8B7E-06C613597320", name: "Beyonc\u00e9", kind: "artist" },
      { id: "97AF588F-3CA4-43A4-8992-9638023DB3F3", name: "The Devil Wears Prada", kind: "movie", year: 2006 },
      ],
    },
    b:
    {
      name: "Omar",
      beenTo: [{ id: "305155CE-595B-4D04-8FDF-F6E5E15ACDC4", name: "Berkeley Social Club" }],
      interests: [
      { id: "427C074F-396A-4218-9809-D67976960A65", name: "Anthony Bourdain: Parts Unknown", kind: "tv_show", year: 2013 },
      { id: "70CAE5BF-2F4C-445C-A3E5-4EDACFC3591C", name: "Radiohead", kind: "artist" },
      { id: "A499EC25-7FF6-46DE-9DA5-3E78E99B9E26", name: "Parasite", kind: "movie", year: 2019 },
      ],
    },
  },
];
