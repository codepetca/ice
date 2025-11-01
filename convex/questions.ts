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
    optionA: v.string(),
    optionB: v.string(),
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
        text: "Would you rather...",
        category: "food",
        optionA: "Pizza for every meal",
        optionB: "Never eat pizza again",
        followUp: "What's your go-to pizza topping?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "superpowers",
        optionA: "Fly",
        optionB: "Be invisible",
        followUp: "Where would you go first?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "time",
        optionA: "Visit the past",
        optionB: "Visit the future",
        followUp: "What time period would you choose?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "preferences",
        optionA: "Always be too hot",
        optionB: "Always be too cold",
        followUp: "What's your ideal temperature?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "lifestyle",
        optionA: "Live in the city",
        optionB: "Live in the countryside",
        followUp: "What do you love most about where you live now?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "entertainment",
        optionA: "Only watch movies",
        optionB: "Only watch TV series",
        followUp: "What's your all-time favorite?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "social",
        optionA: "Be able to talk to animals",
        optionB: "Be able to speak all languages",
        followUp: "What would you say first?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "food",
        optionA: "Sweet breakfast",
        optionB: "Savory breakfast",
        followUp: "What's your favorite breakfast food?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "adventure",
        optionA: "Explore the ocean depths",
        optionB: "Explore outer space",
        followUp: "What would you hope to discover?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "preferences",
        optionA: "Never use social media again",
        optionB: "Never watch another movie/show",
        followUp: "How much time do you spend on screens?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "talents",
        optionA: "Be a great artist",
        optionB: "Be a great musician",
        followUp: "What art form speaks to you most?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "food",
        optionA: "Coffee",
        optionB: "Tea",
        followUp: "How do you take it?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "lifestyle",
        optionA: "Always be 10 minutes late",
        optionB: "Always be 20 minutes early",
        followUp: "Are you usually on time?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "entertainment",
        optionA: "Read minds",
        optionB: "Teleport anywhere",
        followUp: "How would you use that power?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "pets",
        optionA: "Have a dog",
        optionB: "Have a cat",
        followUp: "Do you have any pets?",
        active: true,
      },
    ];

    for (const question of questions) {
      await ctx.db.insert("questions", question);
    }

    return { message: `Seeded ${questions.length} questions` };
  },
});
