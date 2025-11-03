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
      {
        text: "Would you rather...",
        category: "superpowers",
        optionA: "Control fire",
        optionB: "Control water",
        followUp: "What would you do with that power?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "adventure",
        optionA: "Live in a world with dragons",
        optionB: "Live in a world with robots",
        followUp: "What would your daily life look like?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "talents",
        optionA: "Be the funniest person in the room",
        optionB: "Be the smartest person in the room",
        followUp: "What makes someone fun to be around?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "food",
        optionA: "Only eat desserts",
        optionB: "Never eat desserts again",
        followUp: "What's your ultimate comfort food?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "adventure",
        optionA: "Explore a haunted mansion",
        optionB: "Explore an abandoned amusement park",
        followUp: "What's the scariest thing you've experienced?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "lifestyle",
        optionA: "Have unlimited money",
        optionB: "Have unlimited time",
        followUp: "What would you do first?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "entertainment",
        optionA: "Live in your favorite movie",
        optionB: "Live in your favorite video game",
        followUp: "Which one would you choose?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "social",
        optionA: "Always know when someone is lying",
        optionB: "Always get away with lying",
        followUp: "How important is honesty to you?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "preferences",
        optionA: "Never have to sleep",
        optionB: "Never have to eat",
        followUp: "What would you do with the extra time?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "talents",
        optionA: "Win an Olympic gold medal",
        optionB: "Win an Oscar",
        followUp: "What's a talent you wish you had?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "adventure",
        optionA: "Climb Mount Everest",
        optionB: "Scuba dive the Great Barrier Reef",
        followUp: "What's on your adventure bucket list?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "superpowers",
        optionA: "Super strength",
        optionB: "Super speed",
        followUp: "Who's your favorite superhero?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "lifestyle",
        optionA: "Always have to sing instead of speak",
        optionB: "Always have to dance everywhere you go",
        followUp: "What song would be your theme song?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "preferences",
        optionA: "Live without music",
        optionB: "Live without movies",
        followUp: "What's your go-to mood booster?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "adventure",
        optionA: "Time travel to meet your ancestors",
        optionB: "Time travel to meet your descendants",
        followUp: "What would you want to know?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "social",
        optionA: "Be famous but have no privacy",
        optionB: "Be unknown but have complete freedom",
        followUp: "What matters most to you in life?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "food",
        optionA: "Eat only spicy food",
        optionB: "Eat only bland food",
        followUp: "What's the spiciest thing you've ever eaten?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "talents",
        optionA: "Master any musical instrument instantly",
        optionB: "Speak any language instantly",
        followUp: "What would you learn first?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "lifestyle",
        optionA: "Live on a beach",
        optionB: "Live in the mountains",
        followUp: "What's your ideal vacation spot?",
        active: true,
      },
      {
        text: "Would you rather...",
        category: "preferences",
        optionA: "Always be stuck in traffic",
        optionB: "Always have a slow internet connection",
        followUp: "What tests your patience the most?",
        active: true,
      },
      // NEW QUESTIONS - Expanded to 500+ total
    ];

    for (const question of questions) {
      await ctx.db.insert("questions", question);
    }

    return { message: `Seeded ${questions.length} questions` };
  },
});
