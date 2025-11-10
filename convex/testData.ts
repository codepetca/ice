import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Test data generator for Phase 2 testing
export const generateTestRoom = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

    // Create test room with code "TEST" (4 letters for easy testing)
    const roomId = await ctx.db.insert("rooms", {
      code: "TEST",
      pin: "1234",
      name: "Test Room",
      phase1Active: false,
      phase1Duration: 600, // 10 minutes
      phase1StartedAt: now - 600000, // Started 10 minutes ago (finished)
      maxGroupSize: 4,
      createdAt: now,
      expiresAt: now + fortyEightHours,
    });

    // Test avatars
    const avatars = [
      "🦁", "🐯", "🦊", "🐼", "🐨", "🐸", "🦉", "🦄",
      "🐘", "🦒", "🦘", "🦫", "🦦", "🦥", "🦨", "🐿️",
      "🦔", "🦇", "🐺", "🦁"
    ];

    // Create 20 test users
    const userIds = [];
    for (let i = 0; i < 20; i++) {
      const userId = await ctx.db.insert("users", {
        roomId,
        avatar: avatars[i],
        code: 10 + i,
        joinedAt: now - 500000,
        status: "available",
      });
      userIds.push(userId);
    }

    // Get all questions
    const questions = await ctx.db.query("questions").collect();

    // Create test answers with varied distributions to test all buckets
    const distributions = [
      { percentA: 15, name: "Few (15%)" },      // Few bucket
      { percentA: 40, name: "Less (40%)" },     // Less bucket
      { percentA: 50, name: "Half (50%)" },     // Half bucket
      { percentA: 60, name: "More (60%)" },     // More bucket
      { percentA: 80, name: "Most (80%)" },     // Most bucket
      { percentA: 33, name: "Few/Less edge" },  // Edge case
      { percentA: 48, name: "Less/Half edge" }, // Edge case
      { percentA: 52, name: "Half/More edge" }, // Edge case
      { percentA: 65, name: "More/Most edge" }, // Edge case
    ];

    // Create fake groups and answers
    let groupCount = 0;
    for (let i = 0; i < Math.min(questions.length, distributions.length); i++) {
      const question = questions[i];
      const dist = distributions[i];

      // Create a fake group for each question
      const groupId = await ctx.db.insert("groups", {
        roomId,
        user1Id: userIds[groupCount % userIds.length],
        user2Id: userIds[(groupCount + 1) % userIds.length],
        user3Id: userIds[(groupCount + 2) % userIds.length],
        user4Id: userIds[(groupCount + 3) % userIds.length],
        memberCount: 4,
        currentQuestionId: question._id,
        status: "completed",
        createdAt: now - 400000,
        completedAt: now - 300000,
      });
      groupCount++;

      // Calculate how many users should answer A vs B based on distribution
      const numAnsweringA = Math.round((dist.percentA / 100) * userIds.length);
      const numAnsweringB = userIds.length - numAnsweringA;

      // Create answers for all users
      for (let j = 0; j < userIds.length; j++) {
        const choice = j < numAnsweringA ? "A" : "B";

        await ctx.db.insert("answers", {
          roomId,
          groupId,
          questionId: question._id,
          userId: userIds[j],
          choice,
          skipped: false,
          timestamp: now - 300000 + j * 1000,
        });
      }

      console.log(`Created answers for question ${i + 1}: ${dist.percentA}% chose A (${dist.name})`);
    }

    // Generate the game automatically so preview shows up
    const gameQuestions = [];
    for (let i = 0; i < Math.min(questions.length, distributions.length); i++) {
      const question = questions[i];
      const dist = distributions[i];

      gameQuestions.push({
        questionId: question._id,
        questionText: question.text,
        optionA: question.optionA,
        optionB: question.optionB,
        percentA: dist.percentA,
        percentB: 100 - dist.percentA,
        totalResponses: userIds.length,
      });
    }

    // Create game
    const gameId = await ctx.db.insert("games", {
      roomId,
      status: "not_started",
      currentRound: 0,
      totalRounds: gameQuestions.length,
      startedAt: undefined,
      completedAt: undefined,
    });

    // Create rounds
    for (let i = 0; i < gameQuestions.length; i++) {
      const q = gameQuestions[i];
      await ctx.db.insert("gameRounds", {
        gameId,
        roundNumber: i + 1,
        questionId: q.questionId,
        questionText: q.questionText,
        correctAnswer: q.percentA >= q.percentB ? "A" : "B",
        actualPercentage: Math.max(q.percentA, q.percentB),
        revealedAt: undefined,
      });
    }

    return {
      success: true,
      roomId,
      gameId,
      roomCode: "TEST",
      pin: "1234",
      usersCreated: userIds.length,
      questionsAnswered: Math.min(questions.length, distributions.length),
      totalRounds: gameQuestions.length,
      message: "Test room created with game ready! Join at /host with code TEST and PIN 1234",
    };
  },
});

// Clean up ALL data except questions (for dev reset)
export const cleanupAllData = mutation({
  args: {},
  handler: async (ctx) => {
    let deletedCounts = {
      rooms: 0,
      users: 0,
      groups: 0,
      groupRequests: 0,
      answers: 0,
      games: 0,
      gameRounds: 0,
      votes: 0,
      scores: 0,
    };

    // Delete all rooms
    const rooms = await ctx.db.query("rooms").collect();
    for (const room of rooms) {
      await ctx.db.delete(room._id);
      deletedCounts.rooms++;
    }

    // Delete all users
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
      deletedCounts.users++;
    }

    // Delete all groups
    const groups = await ctx.db.query("groups").collect();
    for (const group of groups) {
      await ctx.db.delete(group._id);
      deletedCounts.groups++;
    }

    // Delete all group requests
    const groupRequests = await ctx.db.query("groupRequests").collect();
    for (const req of groupRequests) {
      await ctx.db.delete(req._id);
      deletedCounts.groupRequests++;
    }

    // Delete all answers
    const answers = await ctx.db.query("answers").collect();
    for (const answer of answers) {
      await ctx.db.delete(answer._id);
      deletedCounts.answers++;
    }

    // Delete all games (and their related data)
    const games = await ctx.db.query("games").collect();
    for (const game of games) {
      // Delete game rounds
      const rounds = await ctx.db
        .query("gameRounds")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      for (const round of rounds) {
        // Delete votes
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_round", (q) => q.eq("roundId", round._id))
          .collect();
        for (const vote of votes) {
          await ctx.db.delete(vote._id);
          deletedCounts.votes++;
        }
        await ctx.db.delete(round._id);
        deletedCounts.gameRounds++;
      }

      // Delete scores
      const scores = await ctx.db
        .query("scores")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      for (const score of scores) {
        await ctx.db.delete(score._id);
        deletedCounts.scores++;
      }

      await ctx.db.delete(game._id);
      deletedCounts.games++;
    }

    // Count remaining questions (not deleted)
    const questions = await ctx.db.query("questions").collect();

    return {
      success: true,
      message: "All data cleared (except questions)",
      deleted: deletedCounts,
      questionsPreserved: questions.length,
    };
  },
});

// Clean up test data
export const cleanupTestRoom = mutation({
  args: {},
  handler: async (ctx) => {
    // Find test room
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", "TEST"))
      .first();

    if (!room) {
      return { message: "No test room found" };
    }

    // Delete all users in test room
    const users = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    // Delete all groups
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();
    for (const group of groups) {
      await ctx.db.delete(group._id);
    }

    // Delete all answers
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();
    for (const answer of answers) {
      await ctx.db.delete(answer._id);
    }

    // Delete any games
    const games = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();
    for (const game of games) {
      // Delete game rounds
      const rounds = await ctx.db
        .query("gameRounds")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      for (const round of rounds) {
        // Delete votes
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_round", (q) => q.eq("roundId", round._id))
          .collect();
        for (const vote of votes) {
          await ctx.db.delete(vote._id);
        }
        await ctx.db.delete(round._id);
      }

      // Delete scores
      const scores = await ctx.db
        .query("scores")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      for (const score of scores) {
        await ctx.db.delete(score._id);
      }

      await ctx.db.delete(game._id);
    }

    // Delete room
    await ctx.db.delete(room._id);

    return {
      success: true,
      message: "Test room cleaned up",
      deleted: {
        users: users.length,
        groups: groups.length,
        answers: answers.length,
        games: games.length,
      },
    };
  },
});
