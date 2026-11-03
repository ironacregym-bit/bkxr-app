import {
  getEquipment,
  getExercises,
  getRecentWorkouts,
} from "@pt/tools";

export const toolRegistry = {
  equipment: async () => {
    return await getEquipment();
  },

  recentWorkouts: async () => {
    return await getRecentWorkouts(10);
  },

  exercises: async () => {
    return await getExercises("Farm Strong");
  },
};

export type AgentTool =
  keyof typeof toolRegistry;
