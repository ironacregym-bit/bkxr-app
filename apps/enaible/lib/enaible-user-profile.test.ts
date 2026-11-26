import { describe, expect, it } from "vitest";
import { buildEnaibleUserProfile } from "./enaible-user-profile";

describe("EnAIble user profiles", () => {
  it("maps verified auth identity to the isolated profile schema", () => {
    expect(
      buildEnaibleUserProfile(
        {
          uid: "user-1",
          email: "person@example.com",
          name: "Example Person",
        },
        "2026-11-26T12:00:00.000Z"
      )
    ).toEqual({
      userId: "user-1",
      email: "person@example.com",
      displayName: "Example Person",
      createdAt: "2026-11-26T12:00:00.000Z",
      updatedAt: "2026-11-26T12:00:00.000Z",
    });
  });

  it("preserves profile creation time and handles missing claims", () => {
    expect(
      buildEnaibleUserProfile(
        { uid: "user-1" },
        "2026-11-26T13:00:00.000Z",
        "2026-11-25T13:00:00.000Z"
      )
    ).toEqual({
      userId: "user-1",
      email: null,
      displayName: null,
      createdAt: "2026-11-25T13:00:00.000Z",
      updatedAt: "2026-11-26T13:00:00.000Z",
    });
  });
});
