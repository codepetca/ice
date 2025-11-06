import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Question generation algorithm for Phase 2
// Takes Phase 1 answers and generates "What % of the class..." questions
// Helper function to determine which bucket a percentage falls into
function getPercentageBucket(percentage: number): string {
  if (percentage < 35) return "few";
  if (percentage < 48) return "less";
  if (percentage < 52) return "half";
  if (percentage < 65) return "more";
  return "most";
}

async function generateSlideshowQuestions(
  ctx: any,
  roomId: any
): Promise<
  Array<{
    questionId: any;
    questionText: string;
    optionA: string;
    optionB: string;
    percentA: number;
    percentB: number;
    totalResponses: number;
  }>
> {
  // Get all answers for this room
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .collect();

  // Get all questions to get their text
  const questions = await ctx.db.query("questions").collect();
  const questionMap = new Map(questions.map((q: any) => [q._id, q]));

  // Get total users in room for response rate calculation
  const users = await ctx.db
    .query("users")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .collect();
  const totalUsers = users.length;

  // Group answers by question
  const answersByQuestion = new Map<string, Array<any>>();
  for (const answer of answers) {
    const key = answer.questionId;
    if (!answersByQuestion.has(key)) {
      answersByQuestion.set(key, []);
    }
    answersByQuestion.get(key)!.push(answer);
  }

  // Generate slideshow questions
  const generatedQuestions = [];

  for (const [questionId, questionAnswers] of answersByQuestion.entries()) {
    // Filter out skipped answers
    const validAnswers = questionAnswers.filter((a) => !a.skipped);

    // Check if we have ≥60% response rate
    const responseRate = validAnswers.length / totalUsers;
    if (responseRate < 0.6) continue; // Skip questions with low response

    // Calculate percentages for A and B
    const aCount = validAnswers.filter((a) => a.choice === "A").length;
    const bCount = validAnswers.filter((a) => a.choice === "B").length;
    const total = validAnswers.length;

    if (total === 0) continue;

    const percentA = Math.round((aCount / total) * 100);
    const percentB = Math.round((bCount / total) * 100);

    // Get question data
    const question = questionMap.get(questionId);
    if (!question) continue;

    generatedQuestions.push({
      questionId,
      questionText: (question as any).text,
      optionA: (question as any).optionA,
      optionB: (question as any).optionB,
      percentA,
      percentB,
      totalResponses: total,
    });
  }

  // Take up to 12 questions
  return generatedQuestions.slice(0, 12);
}

// Generate and create a new game for the room
export const generateGame = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    // Check if game already exists for this room
    const existingGame = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (existingGame) {
      return { gameId: existingGame._id, message: "Game already exists" };
    }

    // Generate questions
    const questions = await generateSlideshowQuestions(ctx, args.roomId);

    if (questions.length === 0) {
      throw new Error(
        "Not enough data to generate slideshow. Need at least 60% response rate."
      );
    }

    // Create game
    const gameId = await ctx.db.insert("games", {
      roomId: args.roomId,
      status: "not_started",
      currentRound: 0,
      totalRounds: questions.length,
      startedAt: undefined,
      completedAt: undefined,
    });

    // Create rounds with original question data and percentages
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await ctx.db.insert("gameRounds", {
        gameId,
        roundNumber: i + 1,
        questionId: q.questionId,
        questionText: q.questionText,
        correctAnswer: q.percentA >= q.percentB ? "A" : "B", // Winner is the one with higher percentage
        actualPercentage: Math.max(q.percentA, q.percentB), // Highest percentage
        revealedAt: undefined,
      });
    }

    return { gameId, totalRounds: questions.length };
  },
});

// Start the game
export const startGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "not_started")
      throw new Error("Game already started");

    await ctx.db.patch(args.gameId, {
      status: "in_progress",
      currentRound: 1,
      startedAt: Date.now(),
    });
  },
});

// Submit a vote for the current round
export const submitVote = mutation({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
    choice: v.string(), // "A" or "B"
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "in_progress") throw new Error("Game not in progress");

    // Get current round
    const currentRound = await ctx.db
      .query("gameRounds")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("roundNumber", game.currentRound)
      )
      .first();

    if (!currentRound) throw new Error("Current round not found");

    // Check if user already voted this round
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_game_and_user", (q) =>
        q.eq("gameId", args.gameId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("roundId"), currentRound._id))
      .first();

    if (existingVote) {
      throw new Error("Already voted this round");
    }

    // Determine if answer is correct
    const isCorrect = args.choice === currentRound.correctAnswer;

    // Insert vote
    await ctx.db.insert("votes", {
      roundId: currentRound._id,
      gameId: args.gameId,
      userId: args.userId,
      choice: args.choice,
      isCorrect,
      timestamp: Date.now(),
    });

    // Update or create score
    const existingScore = await ctx.db
      .query("scores")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (existingScore) {
      await ctx.db.patch(existingScore._id, {
        totalCorrect: existingScore.totalCorrect + (isCorrect ? 1 : 0),
        totalVotes: existingScore.totalVotes + 1,
      });
    } else {
      await ctx.db.insert("scores", {
        gameId: args.gameId,
        userId: args.userId,
        totalCorrect: isCorrect ? 1 : 0,
        totalVotes: 1,
        rank: undefined,
      });
    }
  },
});

// Reveal the current round results
export const revealRound = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "in_progress") throw new Error("Game not in progress");

    // Get current round
    const currentRound = await ctx.db
      .query("gameRounds")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("roundNumber", game.currentRound)
      )
      .first();

    if (!currentRound) throw new Error("Current round not found");
    if (currentRound.revealedAt) throw new Error("Round already revealed");

    await ctx.db.patch(currentRound._id, {
      revealedAt: Date.now(),
    });
  },
});

// Advance to the next round (with looping support)
export const advanceRound = mutation({
  args: {
    gameId: v.id("games"),
    loop: v.optional(v.boolean()), // If true, loop back to first slide instead of completing
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "in_progress") throw new Error("Game not in progress");

    // Check if current round is revealed
    const currentRound = await ctx.db
      .query("gameRounds")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("roundNumber", game.currentRound)
      )
      .first();

    if (!currentRound?.revealedAt) {
      throw new Error("Must reveal current round before advancing");
    }

    // Check if this is the last round
    if (game.currentRound >= game.totalRounds) {
      if (args.loop) {
        // Loop back to first round
        // First, un-reveal all rounds
        const rounds = await ctx.db
          .query("gameRounds")
          .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
          .collect();

        for (const round of rounds) {
          await ctx.db.patch(round._id, {
            revealedAt: undefined,
          });
        }

        // Reset to first round
        await ctx.db.patch(args.gameId, {
          currentRound: 1,
        });
      } else {
        // End the game
        await ctx.db.patch(args.gameId, {
          status: "completed",
          completedAt: Date.now(),
        });

        // Calculate final rankings
        const scores = await ctx.db
          .query("scores")
          .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
          .collect();

        // Sort by totalCorrect descending
        scores.sort((a, b) => b.totalCorrect - a.totalCorrect);

        // Assign ranks (only top 5)
        for (let i = 0; i < Math.min(5, scores.length); i++) {
          await ctx.db.patch(scores[i]._id, {
            rank: i + 1,
          });
        }
      }
    } else {
      // Advance to next round
      await ctx.db.patch(args.gameId, {
        currentRound: game.currentRound + 1,
      });
    }
  },
});

// End the game immediately
export const endGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    await ctx.db.patch(args.gameId, {
      status: "completed",
      completedAt: Date.now(),
    });

    // Calculate final rankings
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Sort by totalCorrect descending
    scores.sort((a, b) => b.totalCorrect - a.totalCorrect);

    // Assign ranks (only top 5)
    for (let i = 0; i < Math.min(5, scores.length); i++) {
      await ctx.db.patch(scores[i]._id, {
        rank: i + 1,
      });
    }
  },
});

// Get game state for a room
export const getGameByRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
  },
});

// Get complete game state
export const getGameState = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    // Get current round if in progress
    let currentRound = null;
    if (game.status === "in_progress") {
      currentRound = await ctx.db
        .query("gameRounds")
        .withIndex("by_game_and_round", (q) =>
          q.eq("gameId", args.gameId).eq("roundNumber", game.currentRound)
        )
        .first();
    }

    return {
      game,
      currentRound,
    };
  },
});

// Get current round with full question data and percentages
export const getCurrentRound = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "in_progress") return null;

    const round = await ctx.db
      .query("gameRounds")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("roundNumber", game.currentRound)
      )
      .first();

    if (!round) return null;

    // Get original question to fetch optionA and optionB
    const question = await ctx.db.get(round.questionId);

    // Get all answers for this question in this room
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_room", (q) => q.eq("roomId", game.roomId))
      .filter((q) => q.eq(q.field("questionId"), round.questionId))
      .collect();

    const validAnswers = answers.filter((a) => !a.skipped);
    const aCount = validAnswers.filter((a) => a.choice === "A").length;
    const bCount = validAnswers.filter((a) => a.choice === "B").length;
    const total = validAnswers.length;

    const percentA = total > 0 ? Math.round((aCount / total) * 100) : 0;
    const percentB = total > 0 ? Math.round((bCount / total) * 100) : 0;

    return {
      round,
      questionData: {
        text: question?.text || round.questionText,
        optionA: (question as any)?.optionA || "Option A",
        optionB: (question as any)?.optionB || "Option B",
        percentA,
        percentB,
        totalResponses: total,
      },
    };
  },
});

// Get votes for a specific round
export const getRoundVotes = query({
  args: { roundId: v.id("gameRounds") },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) return null;

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();

    const fewVotes = votes.filter((v) => v.choice === "few").length;
    const lessVotes = votes.filter((v) => v.choice === "less").length;
    const halfVotes = votes.filter((v) => v.choice === "half").length;
    const moreVotes = votes.filter((v) => v.choice === "more").length;
    const mostVotes = votes.filter((v) => v.choice === "most").length;

    return {
      round,
      votes,
      voteCounts: {
        few: fewVotes,
        less: lessVotes,
        half: halfVotes,
        more: moreVotes,
        most: mostVotes,
        total: votes.length,
      },
    };
  },
});

// Get leaderboard
export const getLeaderboard = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // Get all scores with rank
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_game_and_rank", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.neq(q.field("rank"), undefined))
      .collect();

    // Get user details for each score
    const leaderboard = await Promise.all(
      scores.map(async (score) => {
        const user = await ctx.db.get(score.userId);
        return {
          rank: score.rank,
          userId: score.userId,
          avatar: user?.avatar || "👤",
          totalCorrect: score.totalCorrect,
          totalVotes: score.totalVotes,
        };
      })
    );

    // Sort by rank
    leaderboard.sort((a, b) => (a.rank || 999) - (b.rank || 999));

    return leaderboard;
  },
});

// Get user's current score in a game
export const getUserScore = query({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scores")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
  },
});

// Check if user has voted in current round
export const hasVotedThisRound = query({
  args: {
    gameId: v.id("games"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "in_progress") return false;

    const currentRound = await ctx.db
      .query("gameRounds")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("roundNumber", game.currentRound)
      )
      .first();

    if (!currentRound) return false;

    const vote = await ctx.db
      .query("votes")
      .withIndex("by_game_and_user", (q) =>
        q.eq("gameId", args.gameId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("roundId"), currentRound._id))
      .first();

    return !!vote;
  },
});
