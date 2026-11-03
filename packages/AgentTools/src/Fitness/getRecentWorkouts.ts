import firestore from "../firestoreClient";

export interface RecentWorkout {
  id: string;
  workout_id?: string;
  workout_name?: string;
  workout_type?: string;
  focus?: string;
  notes?: string;
  recurring?: boolean;
  recurring_day?: string;
  is_benchmark?: boolean;
  created_at?: any;
}

export async function getRecentWorkouts(
  limit = 10
): Promise<RecentWorkout[]> {
  const snapshot = await firestore
    .collection("workouts")
    .where("workout_type", "==", "Farm Strong")
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RecentWorkout[];
}
