import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a canonical pair key from two codes
function makePairKey(code1: number, code2: number): string {
  const min = Math.min(code1, code2);
  const max = Math.max(code1, code2);
  return `${min}-${max}`;
}

// Select a question for this pair, avoiding recent questions for both students
async function selectQuestion(
  ctx: any,
  student1Id: string,
  student2Id: string
) {
  // Get recent questions for both students (last 3)
  const student1Pairs = await ctx.db
    .query("pairs")
    .withIndex("by_student1", (q: any) => q.eq("student1Id", student1Id))
    .order("desc")
    .take(3);

  const student2Pairs1 = await ctx.db
    .query("pairs")
    .withIndex("by_student1", (q: any) => q.eq("student1Id", student2Id))
    .order("desc")
    .take(3);

  const student2Pairs2 = await ctx.db
    .query("pairs")
    .withIndex("by_student2", (q: any) => q.eq("student2Id", student2Id))
    .order("desc")
    .take(3);

  const recentQuestionIds = new Set([
    ...student1Pairs.map((p: any) => p.questionId),
    ...student2Pairs1.map((p: any) => p.questionId),
    ...student2Pairs2.map((p: any) => p.questionId),
  ]);

  // Get all active questions
  const allQuestions = await ctx.db
    .query("questions")
    .filter((q: any) => q.eq(q.field("active"), true))
    .collect();

  // Filter out recently used questions
  const availableQuestions = allQuestions.filter(
    (q: any) => !recentQuestionIds.has(q._id)
  );

  // If no available questions, use any question
  const questionPool =
    availableQuestions.length > 0 ? availableQuestions : allQuestions;

  // Select random question
  const randomIndex = Math.floor(Math.random() * questionPool.length);
  return questionPool[randomIndex];
}

export const requestPairById = mutation({
  args: {
    studentId: v.id("students"),
    partnerId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    const partner = await ctx.db.get(args.partnerId);
    if (!partner) throw new Error("Partner not found");

    // Can't pair with yourself
    if (student._id === partner._id) {
      throw new Error("Cannot pair with yourself");
    }

    // Check if class is still active
    const classDoc = await ctx.db.get(student.classId);
    if (!classDoc || !classDoc.phase1Active) {
      throw new Error("Class is not active");
    }

    const pairKey = makePairKey(student.code, partner.code);

    // Check if they already met
    const existingPair = await ctx.db
      .query("pairs")
      .withIndex("by_class_and_pair_key", (q) =>
        q.eq("classId", student.classId).eq("pairKey", pairKey)
      )
      .first();

    if (existingPair) {
      throw new Error("You already met this person");
    }

    // Create the pair immediately (no mutual request needed for scroll wheel selection)
    const question = await selectQuestion(ctx, args.studentId, partner._id);

    const pairId = await ctx.db.insert("pairs", {
      classId: student.classId,
      student1Id: args.studentId,
      student2Id: partner._id,
      student1Code: student.code,
      student2Code: partner.code,
      pairKey,
      questionId: question._id,
      student1Answered: false,
      student2Answered: false,
      createdAt: Date.now(),
    });

    // Update both students' current pair
    await ctx.db.patch(args.studentId, { currentPairId: pairId });
    await ctx.db.patch(partner._id, { currentPairId: pairId });

    return {
      paired: true,
      pairId,
      partner: {
        avatar: partner.avatar,
        code: partner.code,
      },
      question: {
        text: question.text,
        unit: question.unit,
        rangeMin: question.rangeMin,
        rangeMax: question.rangeMax,
        followUp: question.followUp,
      },
    };
  },
});

export const requestPair = mutation({
  args: {
    studentId: v.id("students"),
    partnerCode: v.number(),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    // Can't pair with yourself
    if (student.code === args.partnerCode) {
      throw new Error("Cannot pair with yourself");
    }

    // Check if class is still active
    const classDoc = await ctx.db.get(student.classId);
    if (!classDoc || !classDoc.phase1Active) {
      throw new Error("Class is not active");
    }

    // Find the partner
    const partner = await ctx.db
      .query("students")
      .withIndex("by_class_and_code", (q) =>
        q.eq("classId", student.classId).eq("code", args.partnerCode)
      )
      .first();

    if (!partner) throw new Error("Partner not found");

    const pairKey = makePairKey(student.code, args.partnerCode);

    // Check if they already met
    const existingPair = await ctx.db
      .query("pairs")
      .withIndex("by_class_and_pair_key", (q) =>
        q.eq("classId", student.classId).eq("pairKey", pairKey)
      )
      .first();

    if (existingPair) {
      throw new Error("You already met this person");
    }

    // Check for mutual request
    const mutualRequest = await ctx.db
      .query("pairRequests")
      .withIndex("by_class_and_codes", (q) =>
        q
          .eq("classId", student.classId)
          .eq("requesterCode", args.partnerCode)
          .eq("targetCode", student.code)
      )
      .first();

    if (mutualRequest) {
      // Both students have requested each other - create the pair!
      const question = await selectQuestion(ctx, args.studentId, partner._id);

      const pairId = await ctx.db.insert("pairs", {
        classId: student.classId,
        student1Id: args.studentId,
        student2Id: partner._id,
        student1Code: student.code,
        student2Code: partner.code,
        pairKey,
        questionId: question._id,
        student1Answered: false,
        student2Answered: false,
        createdAt: Date.now(),
      });

      // Update both students' current pair
      await ctx.db.patch(args.studentId, { currentPairId: pairId });
      await ctx.db.patch(partner._id, { currentPairId: pairId });

      // Delete the mutual request
      await ctx.db.delete(mutualRequest._id);

      return {
        paired: true,
        pairId,
        partner: {
          avatar: partner.avatar,
          code: partner.code,
        },
        question: {
          text: question.text,
          unit: question.unit,
          rangeMin: question.rangeMin,
          rangeMax: question.rangeMax,
          followUp: question.followUp,
        },
      };
    } else {
      // Create or update request
      const existingRequest = await ctx.db
        .query("pairRequests")
        .withIndex("by_class_and_requester", (q) =>
          q.eq("classId", student.classId).eq("requesterId", args.studentId)
        )
        .first();

      if (existingRequest) {
        await ctx.db.patch(existingRequest._id, {
          targetCode: args.partnerCode,
          createdAt: Date.now(),
        });
      } else {
        await ctx.db.insert("pairRequests", {
          classId: student.classId,
          requesterId: args.studentId,
          requesterCode: student.code,
          targetCode: args.partnerCode,
          createdAt: Date.now(),
        });
      }

      return {
        paired: false,
        waiting: true,
      };
    }
  },
});

export const getCurrentPair = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student || !student.currentPairId) return null;

    const pair = await ctx.db.get(student.currentPairId);
    if (!pair) return null;

    const isStudent1 = pair.student1Id === args.studentId;
    const partnerId = isStudent1 ? pair.student2Id : pair.student1Id;
    const partner = await ctx.db.get(partnerId);
    const question = await ctx.db.get(pair.questionId);

    const myAnswered = isStudent1 ? pair.student1Answered : pair.student2Answered;
    const partnerAnswered = isStudent1 ? pair.student2Answered : pair.student1Answered;

    return {
      pairId: pair._id,
      partner: partner ? { avatar: partner.avatar, code: partner.code } : null,
      question: question
        ? {
            text: question.text,
            unit: question.unit,
            rangeMin: question.rangeMin,
            rangeMax: question.rangeMax,
            followUp: question.followUp,
          }
        : null,
      myAnswered,
      partnerAnswered,
      bothAnswered: myAnswered && partnerAnswered,
      completedAt: pair.completedAt,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    studentId: v.id("students"),
    pairId: v.id("pairs"),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const pair = await ctx.db.get(args.pairId);
    if (!pair) throw new Error("Pair not found");

    const isStudent1 = pair.student1Id === args.studentId;
    if (!isStudent1 && pair.student2Id !== args.studentId) {
      throw new Error("Not part of this pair");
    }

    // Update the pair with the answer
    if (isStudent1) {
      await ctx.db.patch(args.pairId, {
        student1Answer: args.value,
        student1Answered: true,
      });
    } else {
      await ctx.db.patch(args.pairId, {
        student2Answer: args.value,
        student2Answered: true,
      });
    }

    // Store the answer
    await ctx.db.insert("answers", {
      classId: pair.classId,
      pairId: args.pairId,
      questionId: pair.questionId,
      studentId: args.studentId,
      value: args.value,
      skipped: false,
      timestamp: Date.now(),
    });
  },
});

export const completePair = mutation({
  args: {
    studentId: v.id("students"),
    pairId: v.id("pairs"),
  },
  handler: async (ctx, args) => {
    const pair = await ctx.db.get(args.pairId);
    if (!pair) throw new Error("Pair not found");

    await ctx.db.patch(args.pairId, {
      completedAt: Date.now(),
    });

    // Clear current pair from student
    await ctx.db.patch(args.studentId, {
      currentPairId: undefined,
    });

    // Also clear from partner
    const partnerId =
      pair.student1Id === args.studentId ? pair.student2Id : pair.student1Id;
    await ctx.db.patch(partnerId, {
      currentPairId: undefined,
    });
  },
});

export const cancelPairRequest = mutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) return;

    const request = await ctx.db
      .query("pairRequests")
      .withIndex("by_class_and_requester", (q) =>
        q.eq("classId", student.classId).eq("requesterId", args.studentId)
      )
      .first();

    if (request) {
      await ctx.db.delete(request._id);
    }
  },
});

export const sendPairRequestById = mutation({
  args: {
    studentId: v.id("students"),
    partnerId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    const partner = await ctx.db.get(args.partnerId);
    if (!partner) throw new Error("Partner not found");

    // Can't pair with yourself
    if (student._id === partner._id) {
      throw new Error("Cannot pair with yourself");
    }

    // Check if class is still active
    const classDoc = await ctx.db.get(student.classId);
    if (!classDoc || !classDoc.phase1Active) {
      throw new Error("Class is not active");
    }

    const pairKey = makePairKey(student.code, partner.code);

    // Check if they already met
    const existingPair = await ctx.db
      .query("pairs")
      .withIndex("by_class_and_pair_key", (q) =>
        q.eq("classId", student.classId).eq("pairKey", pairKey)
      )
      .first();

    if (existingPair) {
      throw new Error("You already met this person");
    }

    // Check if there's already a pending request from this student
    const existingRequest = await ctx.db
      .query("pairRequests")
      .withIndex("by_class_and_requester", (q) =>
        q.eq("classId", student.classId).eq("requesterId", args.studentId)
      )
      .first();

    if (existingRequest) {
      // Update existing request to new partner
      await ctx.db.patch(existingRequest._id, {
        targetCode: partner.code,
        createdAt: Date.now(),
      });
    } else {
      // Create new pair request
      await ctx.db.insert("pairRequests", {
        classId: student.classId,
        requesterId: args.studentId,
        requesterCode: student.code,
        targetCode: partner.code,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const getPendingRequest = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) return null;

    // Check if someone has requested to pair with this student
    const request = await ctx.db
      .query("pairRequests")
      .withIndex("by_class_and_target", (q) =>
        q.eq("classId", student.classId).eq("targetCode", student.code)
      )
      .first();

    if (!request) return null;

    // Get the requester's info
    const requester = await ctx.db.get(request.requesterId);
    if (!requester) return null;

    return {
      requestId: request._id,
      requester: {
        id: requester._id,
        avatar: requester.avatar,
        code: requester.code,
      },
    };
  },
});

export const acceptPairRequest = mutation({
  args: {
    studentId: v.id("students"),
    requesterId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found");

    const requester = await ctx.db.get(args.requesterId);
    if (!requester) throw new Error("Requester not found");

    // Check if class is still active
    const classDoc = await ctx.db.get(student.classId);
    if (!classDoc || !classDoc.phase1Active) {
      throw new Error("Class is not active");
    }

    const pairKey = makePairKey(student.code, requester.code);

    // Check if they already met
    const existingPair = await ctx.db
      .query("pairs")
      .withIndex("by_class_and_pair_key", (q) =>
        q.eq("classId", student.classId).eq("pairKey", pairKey)
      )
      .first();

    if (existingPair) {
      throw new Error("You already met this person");
    }

    // Find and delete the request
    const request = await ctx.db
      .query("pairRequests")
      .withIndex("by_class_and_requester", (q) =>
        q.eq("classId", student.classId).eq("requesterId", args.requesterId)
      )
      .first();

    if (request) {
      await ctx.db.delete(request._id);
    }

    // Create the pair
    const question = await selectQuestion(ctx, args.studentId, args.requesterId);

    const pairId = await ctx.db.insert("pairs", {
      classId: student.classId,
      student1Id: args.studentId,
      student2Id: args.requesterId,
      student1Code: student.code,
      student2Code: requester.code,
      pairKey,
      questionId: question._id,
      student1Answered: false,
      student2Answered: false,
      createdAt: Date.now(),
    });

    // Update both students' current pair
    await ctx.db.patch(args.studentId, { currentPairId: pairId });
    await ctx.db.patch(args.requesterId, { currentPairId: pairId });

    return {
      paired: true,
      pairId,
      partner: {
        avatar: requester.avatar,
        code: requester.code,
      },
      question: {
        text: question.text,
        unit: question.unit,
        rangeMin: question.rangeMin,
        rangeMax: question.rangeMax,
        followUp: question.followUp,
      },
    };
  },
});

export const declinePairRequest = mutation({
  args: {
    studentId: v.id("students"),
    requesterId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) return;

    // Find and delete the request
    const request = await ctx.db
      .query("pairRequests")
      .withIndex("by_class_and_requester", (q) =>
        q.eq("classId", student.classId).eq("requesterId", args.requesterId)
      )
      .first();

    if (request) {
      await ctx.db.delete(request._id);
    }

    return { success: true };
  },
});
