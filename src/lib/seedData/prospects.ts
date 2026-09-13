// Demo target-company universe for Company Scout.
//
// Company names are real, well-known enterprises — that's the point of a
// prospecting tool. The *evidence* attached to each one in this file is
// explicitly synthetic/illustrative (isDemo: true, sourceUrl always a real
// top-level domain such as the company's own homepage — never a fabricated
// article or review permalink). The UI must label every one of these
// "Demo signal", never present it as a live finding.

export type Vertical = "Telecommunications" | "Healthcare" | "Retail" | "Financial Services" | "Utilities";
export type Country = "Germany" | "United Kingdom" | "France" | "Italy" | "Netherlands";

export interface SeedCompany {
  name: string;
  country: Country;
  vertical: Vertical;
  website: string;
  employeeCountEstimate: string;
}

export const COUNTRIES: Country[] = ["Germany", "United Kingdom", "France", "Italy", "Netherlands"];
export const VERTICALS: Vertical[] = ["Telecommunications", "Healthcare", "Retail", "Financial Services", "Utilities"];

export const USE_CASE_BY_VERTICAL: Record<Vertical, { useCase: string; rationale: string }> = {
  Telecommunications: {
    useCase: "Customer care / billing / field operations",
    rationale:
      "Telecom operators run large multilingual contact centers plus field service teams — high call volume, billing disputes, and truck-roll scheduling are the sharpest AI-augmentable pain points.",
  },
  Healthcare: {
    useCase: "Scheduling / claims / care operations",
    rationale:
      "Healthcare providers and payers are bottlenecked on appointment scheduling, claims processing, and care-coordination admin — high-volume, rules-heavy workflows that suit AI-assisted operations.",
  },
  Retail: {
    useCase: "Customer support / store operations / supply chain",
    rationale:
      "Retailers with large store networks face seasonal support spikes, returns handling, and supply-chain coordination across multiple countries and languages.",
  },
  "Financial Services": {
    useCase: "Customer service / collections / operational workflows",
    rationale:
      "Banks and insurers run large regulated service and collections operations with heavy documentation requirements — a strong fit for AI-assisted case handling.",
  },
  Utilities: {
    useCase: "Customer service / outage support / field workforce ops",
    rationale:
      "Utilities manage high-volume billing inquiries, outage response, and field workforce dispatch, often across legacy systems inherited through mergers.",
  },
};

export const DECISION_MAKER_TITLES_BY_VERTICAL: Record<Vertical, string[]> = {
  Telecommunications: ["VP Customer Operations", "Chief Digital Officer", "Head of Field Services"],
  Healthcare: ["Chief Operating Officer", "VP Patient Services", "Director of Care Operations"],
  Retail: ["VP Customer Experience", "Chief Operating Officer", "Head of Store Operations"],
  "Financial Services": ["Chief Operating Officer", "VP Customer Service", "Head of Collections"],
  Utilities: ["VP Customer Operations", "Chief Transformation Officer", "Head of Field Workforce"],
};

export const SEED_COMPANIES: SeedCompany[] = [
  // Germany
  { name: "Deutsche Telekom", country: "Germany", vertical: "Telecommunications", website: "https://www.telekom.com", employeeCountEstimate: "200,000+" },
  { name: "Telefónica Deutschland", country: "Germany", vertical: "Telecommunications", website: "https://www.telefonica.de", employeeCountEstimate: "8,000+" },
  { name: "Fresenius", country: "Germany", vertical: "Healthcare", website: "https://www.fresenius.com", employeeCountEstimate: "300,000+" },
  { name: "Helios Kliniken", country: "Germany", vertical: "Healthcare", website: "https://www.helios-gesundheit.de", employeeCountEstimate: "80,000+" },
  { name: "Otto Group", country: "Germany", vertical: "Retail", website: "https://www.ottogroup.com", employeeCountEstimate: "40,000+" },
  { name: "METRO AG", country: "Germany", vertical: "Retail", website: "https://www.metroag.de", employeeCountEstimate: "90,000+" },
  { name: "Deutsche Bank", country: "Germany", vertical: "Financial Services", website: "https://www.db.com", employeeCountEstimate: "90,000+" },
  { name: "Allianz", country: "Germany", vertical: "Financial Services", website: "https://www.allianz.com", employeeCountEstimate: "150,000+" },
  { name: "E.ON", country: "Germany", vertical: "Utilities", website: "https://www.eon.com", employeeCountEstimate: "70,000+" },
  { name: "RWE", country: "Germany", vertical: "Utilities", website: "https://www.rwe.com", employeeCountEstimate: "18,000+" },

  // United Kingdom
  { name: "BT Group", country: "United Kingdom", vertical: "Telecommunications", website: "https://www.bt.com", employeeCountEstimate: "80,000+" },
  { name: "Virgin Media O2", country: "United Kingdom", vertical: "Telecommunications", website: "https://www.virginmediao2.co.uk", employeeCountEstimate: "16,000+" },
  { name: "Bupa", country: "United Kingdom", vertical: "Healthcare", website: "https://www.bupa.com", employeeCountEstimate: "85,000+" },
  { name: "AstraZeneca", country: "United Kingdom", vertical: "Healthcare", website: "https://www.astrazeneca.com", employeeCountEstimate: "90,000+" },
  { name: "Tesco", country: "United Kingdom", vertical: "Retail", website: "https://www.tescoplc.com", employeeCountEstimate: "330,000+" },
  { name: "Marks & Spencer", country: "United Kingdom", vertical: "Retail", website: "https://corporate.marksandspencer.com", employeeCountEstimate: "60,000+" },
  { name: "Barclays", country: "United Kingdom", vertical: "Financial Services", website: "https://home.barclays", employeeCountEstimate: "85,000+" },
  { name: "Lloyds Banking Group", country: "United Kingdom", vertical: "Financial Services", website: "https://www.lloydsbankinggroup.com", employeeCountEstimate: "60,000+" },
  { name: "National Grid", country: "United Kingdom", vertical: "Utilities", website: "https://www.nationalgrid.com", employeeCountEstimate: "20,000+" },
  { name: "Centrica", country: "United Kingdom", vertical: "Utilities", website: "https://www.centrica.com", employeeCountEstimate: "18,000+" },

  // France
  { name: "Orange", country: "France", vertical: "Telecommunications", website: "https://www.orange.com", employeeCountEstimate: "130,000+" },
  { name: "Bouygues Telecom", country: "France", vertical: "Telecommunications", website: "https://www.bouyguestelecom.fr", employeeCountEstimate: "10,000+" },
  { name: "Sanofi", country: "France", vertical: "Healthcare", website: "https://www.sanofi.com", employeeCountEstimate: "90,000+" },
  { name: "Korian", country: "France", vertical: "Healthcare", website: "https://www.korian.com", employeeCountEstimate: "60,000+" },
  { name: "Carrefour", country: "France", vertical: "Retail", website: "https://www.carrefour.com", employeeCountEstimate: "320,000+" },
  { name: "Fnac Darty", country: "France", vertical: "Retail", website: "https://www.fnacdarty.com", employeeCountEstimate: "25,000+" },
  { name: "BNP Paribas", country: "France", vertical: "Financial Services", website: "https://group.bnpparibas", employeeCountEstimate: "180,000+" },
  { name: "AXA", country: "France", vertical: "Financial Services", website: "https://www.axa.com", employeeCountEstimate: "140,000+" },
  { name: "EDF", country: "France", vertical: "Utilities", website: "https://www.edf.fr", employeeCountEstimate: "150,000+" },
  { name: "Veolia", country: "France", vertical: "Utilities", website: "https://www.veolia.com", employeeCountEstimate: "200,000+" },

  // Italy
  { name: "TIM (Telecom Italia)", country: "Italy", vertical: "Telecommunications", website: "https://www.gruppotim.it", employeeCountEstimate: "40,000+" },
  { name: "WindTre", country: "Italy", vertical: "Telecommunications", website: "https://www.windtregroup.it", employeeCountEstimate: "6,000+" },
  { name: "Gruppo San Donato", country: "Italy", vertical: "Healthcare", website: "https://www.grupposandonato.it", employeeCountEstimate: "16,000+" },
  { name: "Recordati", country: "Italy", vertical: "Healthcare", website: "https://www.recordati.com", employeeCountEstimate: "4,500+" },
  { name: "Esselunga", country: "Italy", vertical: "Retail", website: "https://www.esselunga.it", employeeCountEstimate: "23,000+" },
  { name: "Coop Italia", country: "Italy", vertical: "Retail", website: "https://www.coopitalia.coop", employeeCountEstimate: "50,000+" },
  { name: "Intesa Sanpaolo", country: "Italy", vertical: "Financial Services", website: "https://group.intesasanpaolo.com", employeeCountEstimate: "95,000+" },
  { name: "UniCredit", country: "Italy", vertical: "Financial Services", website: "https://www.unicredit.eu", employeeCountEstimate: "70,000+" },
  { name: "Enel", country: "Italy", vertical: "Utilities", website: "https://www.enel.com", employeeCountEstimate: "60,000+" },
  { name: "A2A", country: "Italy", vertical: "Utilities", website: "https://www.a2a.eu", employeeCountEstimate: "13,000+" },

  // Netherlands
  { name: "KPN", country: "Netherlands", vertical: "Telecommunications", website: "https://www.kpn.com", employeeCountEstimate: "10,000+" },
  { name: "VodafoneZiggo", country: "Netherlands", vertical: "Telecommunications", website: "https://www.vodafoneziggo.nl", employeeCountEstimate: "7,000+" },
  { name: "Philips", country: "Netherlands", vertical: "Healthcare", website: "https://www.philips.com", employeeCountEstimate: "70,000+" },
  { name: "Achmea", country: "Netherlands", vertical: "Healthcare", website: "https://www.achmea.nl", employeeCountEstimate: "14,000+" },
  { name: "Ahold Delhaize", country: "Netherlands", vertical: "Retail", website: "https://www.aholddelhaize.com", employeeCountEstimate: "400,000+" },
  { name: "Bol.com", country: "Netherlands", vertical: "Retail", website: "https://www.bol.com", employeeCountEstimate: "2,500+" },
  { name: "ING", country: "Netherlands", vertical: "Financial Services", website: "https://www.ing.com", employeeCountEstimate: "60,000+" },
  { name: "ABN AMRO", country: "Netherlands", vertical: "Financial Services", website: "https://www.abnamro.com", employeeCountEstimate: "20,000+" },
  { name: "Vattenfall", country: "Netherlands", vertical: "Utilities", website: "https://www.vattenfall.nl", employeeCountEstimate: "19,000+" },
  { name: "Eneco", country: "Netherlands", vertical: "Utilities", website: "https://www.eneco.nl", employeeCountEstimate: "3,500+" },
];

export const SIGNAL_LIBRARY: Record<Vertical, string[]> = {
  Telecommunications: [
    "Public job postings show a wave of open roles in customer care and field operations.",
    "Leadership has spoken publicly about network modernization and digital transformation.",
    "Operates contact centers across multiple countries and languages.",
    "Legacy billing systems inherited through past mergers add operational complexity.",
  ],
  Healthcare: [
    "Expanding patient volume is straining scheduling and care-coordination teams.",
    "Public statements reference digitizing administrative and claims workflows.",
    "Operates across multiple regions with distinct regulatory and language requirements.",
    "Recent leadership hire focused on operational efficiency and digital care delivery.",
  ],
  Retail: [
    "Store and fulfillment network spans multiple countries with seasonal support spikes.",
    "Public reporting highlights investment in customer experience and support automation.",
    "Multilingual customer support footprint across core European markets.",
    "Supply chain complexity following recent expansion or acquisitions.",
  ],
  "Financial Services": [
    "Regulatory complexity across multiple jurisdictions increases operational overhead.",
    "Public commentary from leadership on AI-assisted customer service and collections.",
    "Large multilingual service and back-office operations footprint.",
    "Recent reorganization signals investment in digital operations.",
  ],
  Utilities: [
    "Legacy systems from past mergers complicate customer and field operations.",
    "Public statements on grid modernization and digital transformation initiatives.",
    "High-volume seasonal billing and outage-support demand.",
    "Field workforce coordination spans a large geographic footprint.",
  ],
};
