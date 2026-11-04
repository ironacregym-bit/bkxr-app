import {
  firestore
} from "@pt/firebase";

export interface EquipmentItem {
  id: string;
  name: string;
  quantity?: number;
  notes?: string;
  active?: boolean;
}

export async function getEquipment(): Promise<
  EquipmentItem[]
> {
  const snapshot = await firestore
    .collection("equipment")
    .get();

return snapshot.docs.map((doc: any) => ({
  id: doc.id,
  ...doc.data(),
})) as EquipmentItem[];
}
