import type { IngestibleDocument } from "@/lib/ai/document-types";

export const demoDocuments: IngestibleDocument[] = [
  {
    name: "Vacati Coastal Menu Intelligence.pdf",
    type: "menu",
    summary:
      "Chef notes for coastal tasting menus, seafood preparations, sauces, and high-confidence pairing logic.",
    tags: ["demo", "menu", "seafood", "pairing", "coastal"],
    content: `Section: Raw Bar and Coastal Starters
Vacati's oyster service favors high-acid pairings with mineral structure. For briny oysters, recommend Muscadet, Chablis, or Champagne with low dosage. Avoid heavily oaked whites because vanilla notes flatten salinity and make mignonette taste sweeter than intended.

Section: Shellfish Entrees
Butter-poached lobster works best with wines that combine ripe citrus, medium body, and a restrained oak profile. White Burgundy, Sonoma Chardonnay with subtle barrel treatment, and Etna Bianco are strong fits. If the sauce includes saffron or preserved lemon, favor wines with saline minerality and orchard fruit.

Section: Tomato and Herb Dishes
Tomato, basil, and olive oil need acidity first. For burrata with tomato conserva, recommend Vermentino, Etna Bianco, or a chillable coastal red with low tannin. Heavy tannins can amplify tomato bitterness.

Section: Grilled Fish
Charcoal-grilled branzino with fennel pollen pairs with Assyrtiko, Albariño, or dry Riesling. The logic is citrus lift, herbal resonance, and enough texture to carry char without masking delicate fish.`,
  },
  {
    name: "Hospitality Recovery Playbook.pdf",
    type: "manual",
    summary:
      "Operational hospitality guidance for service recovery, guest preference capture, pacing, and manager escalation.",
    tags: ["demo", "service", "hospitality", "operations", "guest-experience"],
    content: `Section: Service Recovery
When a guest reports a late course, acknowledge the delay with specificity, give a truthful timing update, and offer a targeted bridge item that fits dietary notes. Avoid generic apologies. A manager should touch the table within five minutes for delays over twelve minutes.

Section: Preference Memory
Capture guest preferences as structured notes: dietary restriction, disliked ingredient, preferred wine style, celebration context, and pacing preference. Never store sensitive medical details beyond operationally necessary allergy language.

Section: Pacing Logic
For tasting menus, the ideal interval between cleared course and next course landing is six to nine minutes. If a table is engaged in a wine discussion, preserve the moment and delay firing the next course by two to four minutes.

Section: Premium Language
Use direct, calm recommendations. Phrases like "the strongest pairing is" or "I would steer you toward" convey confidence. Avoid overexplaining unless the guest asks for detail.`,
  },
  {
    name: "Wine Pairing & Flavor Compatibility Guide.pdf",
    type: "wine-guide",
    summary:
      "Sommelier framework for acidity, tannin, sweetness, umami, spice, and texture-based pairing decisions.",
    tags: ["demo", "wine", "flavor", "explainability", "sommelier"],
    content: `Section: Pairing Principles
Acidity is the primary balancing tool for fat, salt, and tomato. Tannin is useful with protein and char but risky with bitter greens, tomato, chili heat, and delicate seafood. Sweetness reduces perceived spice and can soften high-salt dishes.

Section: Texture Matching
Match intensity before matching flavor. A delicate crudo needs a precise, light-bodied wine. A butter sauce needs either acid to cut richness or body to mirror richness. Sparkling wine is high utility because bubbles reset the palate after fried or salty preparations.

Section: Umami and Earth
Mushroom, aged cheese, soy, seaweed, and roasted tomato create umami pressure. Pair with wines that have savory notes, mature texture, or oxidative complexity. Avoid very young, aggressive tannins unless the dish has enough fat.

Section: Confidence Rules
High confidence requires at least two supporting signals from the documents: flavor bridge, structural match, or operational guest context. Medium confidence applies when the match is plausible but one signal is missing. Low confidence should trigger a clarifying question.`,
  },
];

export const demoPrompts = [
  "What should we pair with butter-poached lobster and preserved lemon?",
  "A guest says their third course is late. What should the floor team do?",
  "Why would you avoid tannic reds with tomato basil burrata?",
];
