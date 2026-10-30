export interface QlooTag {
  id?: string;
  tag_id?: string;
  name: string;
  type?: string;
  subtype?: string;
  weight?: number | null;
  value?: string;
}

export interface QlooHours {
  [day: string]: { opens: string | null; closes: string | null; closed: boolean }[];
}

export interface QlooEntity {
  entity_id: string;
  name: string;
  types?: string[];
  subtype?: string;
  popularity?: number;
  disambiguation?: string;
  location?: { lat: number; lon: number };
  tags?: QlooTag[];
  properties?: {
    address?: string;
    description?: string;
    short_description?: string;
    image?: { url?: string };
    price_level?: number | null;
    business_rating?: number | null;
    hours?: QlooHours;
    is_closed?: boolean;
    website?: string;
    phone?: string;
    primary_genre?: { id?: string; name?: string };
    specialty_dishes?: QlooTag[] | null;
    good_for?: QlooTag[] | null;
    release_year?: number;
    publication_year?: number;
    [key: string]: unknown;
  };
  query?: {
    affinity?: number;
    distance?: number;
    explainability?: {
      'signal.interests.entities'?: { entity_id: string; score: number }[];
    };
  };
}

export interface QlooInsightsResponse {
  success?: boolean;
  results?: { entities?: QlooEntity[]; tags?: QlooTag[] } | QlooEntity[];
}

export interface QlooCompareTag {
  tag_id: string;
  name: string;
  subtype?: string;
  popularity?: number;
  query?: { score?: number; count?: string };
}

export interface QlooCompareResponse {
  results?: {
    a?: QlooCompareTag[];
    b?: QlooCompareTag[];
    tags?: QlooCompareTag[];
  };
}
