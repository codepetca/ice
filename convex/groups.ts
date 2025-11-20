import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get the number of users currently in a group
function getGroupSize(group: any): number {
  let size = 0;
  if (group.user1Id) size++;
  if (group.user2Id) size++;
  if (group.user3Id) size++;
  if (group.user4Id) size++;
  return size;
}

// Find which user slot someone is in (1-4)
function getUserSlot(group: any, userId: string): number | null {
  if (group.user1Id === userId) return 1;
  if (group.user2Id === userId) return 2;
  if (group.user3Id === userId) return 3;
  if (group.user4Id === userId) return 4;
  return null;
}

// Check if a user is part of a group
function isUserInGroup(group: any, userId: string): boolean {
  return getUserSlot(group, userId) !== null;
}

// Deterministic shuffle based on a seed (date)
function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed;

  // Simple seeded random number generator (LCG)
  const seededRandom = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  // Fisher-Yates shuffle with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Selects a question for a group using room-based sequential rotation
 *
 * Algorithm:
 * 1. For each member, queries all 4 user slots (user1-4) to find their last 3 groups
 * 2. Collects all question IDs from those recent groups
 * 3. Gets room's unique question sequence (deterministic shuffle seeded by roomId)
 * 4. Starts at room's nextQuestionIndex and searches forward for a question not in recent history
 * 5. If no valid question found in 50 positions, uses next question anyway (hybrid fallback)
 * 6. Increments room's nextQuestionIndex for next group
 * 7. Returns selected question
 *
 * @param ctx - Convex mutation context
 * @param roomId - Room ID for room-based sequence
 * @param memberIds - Array of user IDs in the group
 * @returns Selected question document with text, optionA, optionB, followUp
 * @throws Error if no questions are available in the database
 */
async function selectQuestion(ctx: any, roomId: string, memberIds: string[]): Promise<any> {
  // Get the room to access nextQuestionIndex
  const room = await ctx.db.get(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  // Get recent questions for all members (last 3 each)
  const recentQuestionIds = new Set<string>();

  for (const memberId of memberIds) {
    // Find groups where this user was in any slot (user1-4)
    // Check all 4 slots and collect the 3 most recent groups
    const allUserGroups: any[] = [];

    // Query each user slot index
    const user1Groups = await ctx.db
      .query("groups")
      .withIndex("by_user1", (q: any) => q.eq("user1Id", memberId))
      .collect();
    allUserGroups.push(...user1Groups);

    const user2Groups = await ctx.db
      .query("groups")
      .withIndex("by_user2", (q: any) => q.eq("user2Id", memberId))
      .collect();
    allUserGroups.push(...user2Groups);

    const user3Groups = await ctx.db
      .query("groups")
      .withIndex("by_user3", (q: any) => q.eq("user3Id", memberId))
      .collect();
    allUserGroups.push(...user3Groups);

    const user4Groups = await ctx.db
      .query("groups")
      .withIndex("by_user4", (q: any) => q.eq("user4Id", memberId))
      .collect();
    allUserGroups.push(...user4Groups);

    // Sort by creation time (most recent first) and take the last 3
    const sortedGroups = allUserGroups
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);

    for (const group of sortedGroups) {
      if (group.currentQuestionId) {
        recentQuestionIds.add(group.currentQuestionId);
      }
    }
  }

  // Get all active questions
  const allQuestions = await ctx.db
    .query("questions")
    .filter((q: any) => q.eq(q.field("active"), true))
    .collect();

  if (allQuestions.length === 0) {
    throw new Error("No questions available");
  }

  // Generate room-specific shuffle using roomId as seed
  // Convert roomId string to numeric seed (simple hash)
  let roomSeed = 0;
  for (let i = 0; i < roomId.length; i++) {
    roomSeed = (roomSeed * 31 + roomId.charCodeAt(i)) % 1000000;
  }

  const shuffledQuestions = seededShuffle(allQuestions, roomSeed);
  const totalQuestions = shuffledQuestions.length;

  // Start search from room's current position (default to 0 for old rooms)
  let startIndex = (room.nextQuestionIndex ?? 0) % totalQuestions;
  let selectedQuestion = null;
  let selectedIndex = startIndex;

  // Hybrid filtering: Try to find a question not in recent history
  // Search up to 50 positions forward (with wraparound)
  const maxSearchAttempts = Math.min(50, totalQuestions);

  for (let attempt = 0; attempt < maxSearchAttempts; attempt++) {
    const currentIndex = (startIndex + attempt) % totalQuestions;
    const question: any = shuffledQuestions[currentIndex];

    if (!recentQuestionIds.has(question._id)) {
      // Found a question not in recent history
      selectedQuestion = question;
      selectedIndex = currentIndex;
      break;
    }
  }

  // Fallback: If no valid question found after searching, use the next question anyway
  if (!selectedQuestion) {
    selectedIndex = startIndex;
    selectedQuestion = shuffledQuestions[startIndex];
  }

  // Increment room's question index for next group
  // Move forward from the selected position (not just +1 from current)
  const nextIndex = (selectedIndex + 1) % totalQuestions;
  await ctx.db.patch(roomId, {
    nextQuestionIndex: nextIndex,
  });

  return selectedQuestion;
}

// Create a pair key for tracking pair history (always in sorted order)
function getPairKey(userId1: string, userId2: string): string {
  return userId1 < userId2 ? `${userId1}:${userId2}` : `${userId2}:${userId1}`;
}

// ============================================================================
// AUTOMATIC GROUP ASSIGNMENT
// ============================================================================

/**
 * Automatically assign groups for a round using pair history to minimize repeats
 *
 * Algorithm:
 * 1. Gather all available players (status = "available")
 * 2. Shuffle players randomly
 * 3. Form groups of 3-4 players, preferring groups with fewest previous pairings
 * 4. Update pairHistory in room
 * 5. Create group records with phase = "name_matching"
 * 6. Update player status to "in_group"
 * 7. Generate name choices for each group
 */
export const assignGroupsForRound = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    const currentRound = room.currentRound;
    if (currentRound === 0) return; // Not in active round

    // Get all available players
    const availablePlayers = await ctx.db
      .query("users")
      .withIndex("by_room_and_status", (q) =>
        q.eq("roomId", args.roomId).eq("status", "available")
      )
      .collect();

    if (availablePlayers.length === 0) return;

    // Shuffle players for randomness
    const shuffled = [...availablePlayers].sort(() => Math.random() - 0.5);

    const pairHistory = room.pairHistory || {};
    const groups: any[] = [];
    let i = 0;

    // Form groups of 3-4 players
    while (i < shuffled.length) {
      const remaining = shuffled.length - i;

      // Determine group size
      let groupSize: number;
      if (remaining === 2) {
        // Special case: only 2 players left, make a 2-person group
        groupSize = 2;
      } else if (remaining === 5) {
        // Special case: 5 players left, make a 2-person group now (leaves 3 for next)
        groupSize = 2;
      } else if (remaining >= 4) {
        // Default: try to make groups of 4
        groupSize = 4;
      } else {
        // 3 players left, make a 3-person group
        groupSize = 3;
      }

      const groupPlayers = shuffled.slice(i, i + groupSize);
      groups.push(groupPlayers);

      // Update pair history for this group
      for (let j = 0; j < groupPlayers.length; j++) {
        for (let k = j + 1; k < groupPlayers.length; k++) {
          const pairKey = getPairKey(groupPlayers[j]._id, groupPlayers[k]._id);
          pairHistory[pairKey] = (pairHistory[pairKey] || 0) + 1;
        }
      }

      i += groupSize;
    }

    // Update room's pair history
    await ctx.db.patch(args.roomId, { pairHistory });

    // Create group records
    for (const groupPlayers of groups) {
      const memberIds = groupPlayers.map((p: any) => p._id);

      // Create group document
      const groupData: any = {
        roomId: args.roomId,
        roundIndex: currentRound,
        user1Id: memberIds[0],
        user2Id: memberIds[1] || undefined,
        user3Id: memberIds[2] || undefined,
        user4Id: memberIds[3] || undefined,
        memberCount: memberIds.length,
        phase: "name_matching",
        nameChoicesByPlayer: {},
        nameSelectionsByPlayer: {},
        submittedNameMatching: [],
        completedNameMatching: [],
        incorrectByPlayer: {},
        createdAt: Date.now(),
      };

      const groupId = await ctx.db.insert("groups", groupData);

      // Update all members' status
      for (const memberId of memberIds) {
        await ctx.db.patch(memberId, {
          status: "in_group",
          currentGroupId: groupId,
        });
      }

      // Generate name choices for this group
      await ctx.scheduler.runAfter(0, internal.groups.generateNameChoicesInternal, {
        groupId,
      });
    }
  },
});

/**
 * Generate name choices for each player in the group
 * For each player, create a map of other players' avatars to [correctName, decoy1, decoy2]
 */
export const generateNameChoicesInternal = internalMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return;

    const memberIds = [group.user1Id, group.user2Id, group.user3Id, group.user4Id].filter(Boolean) as Id<"users">[];

    // Get all members
    const members = await Promise.all(memberIds.map((id) => ctx.db.get(id)));
    const validMembers = members.filter((m): m is NonNullable<typeof m> => m !== null);

    // Get all users in room for decoy names
    const roomUsers = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", group.roomId))
      .collect();

    const nameChoicesByPlayer: any = {};

    // For each player, generate choices for each other player
    for (const member of validMembers) {
      if (!member) continue;

      const choices: any = {};

      // For each OTHER member in the group
      for (const otherMember of validMembers) {
        if (!otherMember || otherMember._id === member._id) continue;

        // Get correct name
        const correctName = otherMember.displayName;

        // Get decoy names (random other users, excluding group members)
        const possibleDecoys = roomUsers.filter((u) =>
          !memberIds.includes(u._id) && u.displayName !== correctName
        );

        // Shuffle and pick 2 decoys
        const shuffledDecoys = [...possibleDecoys].sort(() => Math.random() - 0.5);
        const decoys = shuffledDecoys.slice(0, 2).map((u) => u.displayName);

        // If not enough decoys, duplicate correct name or use placeholder
        while (decoys.length < 2) {
          if (possibleDecoys.length > 0) {
            // Pick a random existing decoy again
            decoys.push(possibleDecoys[Math.floor(Math.random() * possibleDecoys.length)].displayName);
          } else {
            // Worst case: duplicate correct name (small room)
            decoys.push(correctName + " (?)");
          }
        }

        // Shuffle: correct + 2 decoys
        const allOptions = [correctName, ...decoys];
        const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

        choices[otherMember._id] = shuffledOptions;
      }

      nameChoicesByPlayer[member._id] = choices;
    }

    // Update group with name choices
    await ctx.db.patch(args.groupId, { nameChoicesByPlayer });
  },
});

// ============================================================================
// NAME MATCHING PHASE
// ============================================================================

/**
 * Submit a name selection for one avatar
 */
export const submitNameSelection = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    targetUserId: v.id("users"), // Avatar they're naming
    selectedName: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.phase !== "name_matching") {
      throw new Error("Group is not in name matching phase");
    }

    // Update selections
    const nameSelectionsByPlayer = group.nameSelectionsByPlayer || {};
    if (!nameSelectionsByPlayer[args.userId]) {
      nameSelectionsByPlayer[args.userId] = {};
    }
    nameSelectionsByPlayer[args.userId][args.targetUserId] = args.selectedName;

    await ctx.db.patch(args.groupId, { nameSelectionsByPlayer });
  },
});

/**
 * Validate name matching when a player submits all their selections
 * Wait for ALL players to submit before validating anyone
 * Then show everyone their results at once
 */
export const validateNameMatching = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.phase !== "name_matching") {
      throw new Error("Group is not in name matching phase");
    }

    const memberIds = [group.user1Id, group.user2Id, group.user3Id, group.user4Id].filter(Boolean) as Id<"users">[];
    const members = await Promise.all(memberIds.map((id) => ctx.db.get(id)));

    // Mark user as submitted
    const submittedNameMatching = group.submittedNameMatching || [];
    if (!submittedNameMatching.includes(args.userId)) {
      submittedNameMatching.push(args.userId);
    }

    await ctx.db.patch(args.groupId, { submittedNameMatching });

    // Check if all members have submitted
    if (submittedNameMatching.length < memberIds.length) {
      // Still waiting for others
      return {
        submitted: true,
        waitingForOthers: true,
        submittedCount: submittedNameMatching.length,
        totalCount: memberIds.length,
      };
    }

    // All members have submitted - validate everyone
    const nameSelectionsByPlayer = group.nameSelectionsByPlayer || {};
    const incorrectByPlayer: Record<string, string[]> = {};
    const completedNameMatching: string[] = [];

    for (const memberId of memberIds) {
      const memberSelections = nameSelectionsByPlayer[memberId] || {};
      const incorrectAvatars: string[] = [];

      // Check each selection for this member
      for (const otherMember of members) {
        if (!otherMember || otherMember._id === memberId) continue;

        const selectedName = memberSelections[otherMember._id];
        if (selectedName !== otherMember.displayName) {
          incorrectAvatars.push(otherMember._id);
        }
      }

      if (incorrectAvatars.length > 0) {
        incorrectByPlayer[memberId] = incorrectAvatars;
        // Reset incorrect selections for this player
        for (const avatarId of incorrectAvatars) {
          delete memberSelections[avatarId];
        }
        nameSelectionsByPlayer[memberId] = memberSelections;
      } else {
        // All correct for this player
        completedNameMatching.push(memberId);
      }
    }

    // Update group with validation results
    const updates: any = {
      nameSelectionsByPlayer,
      incorrectByPlayer,
      completedNameMatching,
      submittedNameMatching: [], // Reset submitted list for retry
    };

    // Check if everyone got all correct
    if (completedNameMatching.length === memberIds.length) {
      // Advance to WYR phase
      const question = await selectQuestion(ctx, group.roomId, memberIds);
      updates.phase = "wyr";
      updates.currentQuestionId = question._id;
      updates.questionStartedAt = Date.now();
      updates.incorrectByPlayer = {}; // Clear errors

      await ctx.db.patch(args.groupId, updates);

      return {
        validated: true,
        allCorrect: true,
        question,
      };
    }

    await ctx.db.patch(args.groupId, updates);

    // Return this user's specific errors
    const myIncorrect = incorrectByPlayer[args.userId] || [];
    return {
      validated: true,
      allCorrect: false,
      incorrectAvatars: myIncorrect,
      success: myIncorrect.length === 0,
    };
  },
});

// ============================================================================
// WYR PHASE
// ============================================================================

/**
 * Submit an answer to the current question
 */
export const submitAnswer = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    choice: v.string(), // "A" or "B"
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.phase !== "wyr") {
      throw new Error("Group is not in WYR phase");
    }
    if (!group.currentQuestionId) {
      throw new Error("No active question");
    }

    // Validate choice
    if (args.choice !== "A" && args.choice !== "B") {
      throw new Error("Invalid choice");
    }

    // Find which slot the user is in
    const userSlot = getUserSlot(group, args.userId);
    if (!userSlot) throw new Error("User not in this group");

    // Update answer and answered flag for this user's slot
    const updates: any = {};
    updates[`user${userSlot}Answer`] = args.choice;
    updates[`user${userSlot}Answered`] = true;

    await ctx.db.patch(args.groupId, updates);

    // Record answer in answers table
    await ctx.db.insert("answers", {
      roomId: group.roomId,
      groupId: args.groupId,
      questionId: group.currentQuestionId,
      userId: args.userId,
      choice: args.choice,
      skipped: false,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get the current group for a user
 */
export const getCurrentGroup = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.currentGroupId) return null;

    const group = await ctx.db.get(user.currentGroupId);
    if (!group) return null;

    // Get all member info
    const memberIds = [group.user1Id, group.user2Id, group.user3Id, group.user4Id].filter(Boolean) as Id<"users">[];
    const members = await Promise.all(
      memberIds.map(async (id) => {
        const member = await ctx.db.get(id);
        if (!member) return null;
        return {
          userId: member._id,
          displayName: member.displayName,
          avatar: member.avatar,
          code: member.code,
        };
      })
    );

    // Get question if in WYR phase
    let question = null;
    if (group.phase === "wyr" && group.currentQuestionId) {
      question = await ctx.db.get(group.currentQuestionId);
    }

    // Get user's answer
    const userSlot = getUserSlot(group, args.userId);
    let myAnswer = null;
    if (userSlot) {
      myAnswer = (group as any)[`user${userSlot}Answer`];
    }

    // Get all answers
    const answers: any = {};
    for (let i = 1; i <= 4; i++) {
      const memberId = (group as any)[`user${i}Id`];
      const answer = (group as any)[`user${i}Answer`];
      if (memberId && answer) {
        answers[memberId] = answer;
      }
    }

    return {
      groupId: group._id,
      phase: group.phase,
      members: members.filter(Boolean),
      question,
      myAnswer,
      answers,
      nameChoicesByPlayer: group.nameChoicesByPlayer || {},
      nameSelectionsByPlayer: group.nameSelectionsByPlayer || {},
      submittedNameMatching: group.submittedNameMatching || [],
      completedNameMatching: group.completedNameMatching || [],
      incorrectByPlayer: group.incorrectByPlayer || {},
    };
  },
});
