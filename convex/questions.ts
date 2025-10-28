import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAllQuestions = query({
  handler: async (ctx) => {
    return await ctx.db.query("questions").collect();
  },
});

export const getActiveQuestions = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("questions")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

export const addQuestion = mutation({
  args: {
    text: v.string(),
    category: v.string(),
    unit: v.optional(v.string()),
    rangeMin: v.optional(v.number()),
    rangeMax: v.optional(v.number()),
    followUp: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("questions", {
      ...args,
      active: true,
    });
  },
});

export const toggleQuestion = mutation({
  args: {
    questionId: v.id("questions"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questionId, {
      active: args.active,
    });
  },
});

// Seed initial questions
export const seedQuestions = mutation({
  handler: async (ctx) => {
    const existingQuestions = await ctx.db.query("questions").collect();
    if (existingQuestions.length > 0) {
      return { message: "Questions already seeded" };
    }

    const questions = [
      {
        text: "How many hours did you sleep last night?",
        category: "wellness",
        unit: "hours",
        rangeMin: 0,
        rangeMax: 12,
        followUp: "What's your ideal bedtime?",
        active: true,
      },
      {
        text: "How many minutes of screen time (social media) per day?",
        category: "digital",
        unit: "minutes",
        rangeMin: 0,
        rangeMax: 300,
        followUp: "What app do you use most?",
        active: true,
      },
      {
        text: "How many cups of coffee/tea do you drink per day?",
        category: "habits",
        unit: "cups",
        rangeMin: 0,
        rangeMax: 10,
        followUp: "Morning or afternoon person?",
        active: true,
      },
      {
        text: "How many books have you read in the past year?",
        category: "hobbies",
        unit: "books",
        rangeMin: 0,
        rangeMax: 50,
        followUp: "What's your favorite genre?",
        active: true,
      },
      {
        text: "How many different countries have you visited?",
        category: "experiences",
        unit: "countries",
        rangeMin: 0,
        rangeMax: 50,
        followUp: "Where would you go next?",
        active: true,
      },
      {
        text: "How many minutes do you exercise per day on average?",
        category: "wellness",
        unit: "minutes",
        rangeMin: 0,
        rangeMax: 180,
        followUp: "What's your favorite way to move?",
        active: true,
      },
      {
        text: "How many years have you been playing your main hobby?",
        category: "hobbies",
        unit: "years",
        rangeMin: 0,
        rangeMax: 30,
        followUp: "What got you started?",
        active: true,
      },
      {
        text: "How many times per week do you cook at home?",
        category: "habits",
        unit: "times/week",
        rangeMin: 0,
        rangeMax: 21,
        followUp: "What's your signature dish?",
        active: true,
      },
      {
        text: "How many pets have you had in your lifetime?",
        category: "experiences",
        unit: "pets",
        rangeMin: 0,
        rangeMax: 20,
        followUp: "What's your favorite animal?",
        active: true,
      },
      {
        text: "How many languages can you speak conversationally?",
        category: "skills",
        unit: "languages",
        rangeMin: 1,
        rangeMax: 10,
        followUp: "Which one do you want to learn next?",
        active: true,
      },
    ];

    for (const question of questions) {
      await ctx.db.insert("questions", question);
    }

    return { message: `Seeded ${questions.length} questions` };
  },
});
