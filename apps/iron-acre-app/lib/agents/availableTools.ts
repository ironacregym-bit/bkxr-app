/**
 * =====================================================
 * AVAILABLE AGENT TOOLS
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Single source of truth for all
 * agent tools available on the platform.
 *
 * All Agent Builder screens should
 * load tools from here.
 *
 * Future
 * -------
 *
 * - Categories
 * - Tenant Restrictions
 * - Pricing Tiers
 * - Tool Permissions
 * - Tool Groups
 *
 */

export interface AgentToolDefinition {
  id: string;

  name: string;

  description: string;

  category?: string;
}

export const AVAILABLE_TOOLS: AgentToolDefinition[] = [
  {
    id: "equipment",

    name: "Equipment",

    description:
      "Returns available gym equipment",

    category: "Workout",
  },

  {
    id: "exercises",

    name: "Exercises",

    description:
      "Returns approved exercise library",

    category: "Workout",
  },

  {
    id: "recentWorkouts",

    name: "Recent Workouts",

    description:
      "Returns previously generated workouts",

    category: "Workout",
  },

  /**
   * Future Platform Tools
   */

  {
    id: "attendance",

    name: "Attendance",

    description:
      "Returns member attendance information",

    category: "Members",
  },

  {
    id: "members",

    name: "Members",

    description:
      "Returns member data",

    category: "Members",
  },

  {
    id: "assets",

    name: "Assets",

    description:
      "Returns asset register information",

    category: "Business",
  },

  {
    id: "inspections",

    name: "Inspections",

    description:
      "Returns inspection records",

    category: "Business",
  },
];
