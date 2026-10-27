/**
 * =====================================================
 * AVAILABLE AGENT TOOLS
 * =====================================================
 *
 * Single source of truth for all
 * platform tools.
 *
 * Every agent references tools
 * from this list.
 *
 * Future:
 *
 * - Categories
 * - Permissions
 * - Tenant restrictions
 * - Pricing tiers
 *
 */

export const AVAILABLE_TOOLS = [
  {
    id: "equipment",
    name: "Equipment",
    description:
      "Returns available equipment",
  },

  {
    id: "exercises",
    name: "Exercises",
    description:
      "Returns approved exercises",
  },

  {
    id: "recentWorkouts",
    name: "Recent Workouts",
    description:
      "Returns workout history",
  },
];
