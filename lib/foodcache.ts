import firestore from "./firestoreClient";

export type CachedFood = {
  id: string;
  code: string;
  name: string;
  brand: string;
  image: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string | null;
};

function tokenize(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 30);
}

export async function cacheFoods(
  foods: CachedFood[],
  source: string = "openfoodfacts"
) {
  if (!foods.length) return;

  const batch = firestore.batch();

  for (const food of foods.slice(0, 25)) {
    const searchTerms = [
      ...tokenize(food.name),
      ...tokenize(food.brand),
    ];

    const ref = firestore
      .collection("foods")
      .doc(food.code);

    batch.set(
      ref,
      {
        ...food,
        search_terms: [...new Set(searchTerms)],
        source,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function searchCachedFoods(
  query: string,
  limit: number = 15
) {
  const tokens = String(query || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) return [];

  const snap = await firestore
    .collection("foods")
    .where("search_terms", "array-contains", tokens[0])
    .limit(limit)
    .get();

  return snap.docs.map((doc) => doc.data());
}
