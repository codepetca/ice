import { setup, assign } from "xstate";

export type StudentContext = {
  studentId: string | null;
  classId: string | null;
  studentCode: number | null;
  studentName: string;
  partnerCode: number | null;
  partnerName: string | null;
  pairId: string | null;
  question: {
    text: string;
    unit?: string;
    rangeMin?: number;
    rangeMax?: number;
    followUp: string;
  } | null;
  myAnswer: number | null;
  talkingDuration: number; // seconds
};

export type StudentEvents =
  | { type: "JOIN_CLASS"; studentId: string; classId: string; code: number; name: string }
  | { type: "ENTER_PARTNER_CODE"; code: number }
  | { type: "PAIRED"; pairId: string; partnerName: string; question: any }
  | { type: "SUBMIT_ANSWER"; value: number }
  | { type: "BOTH_ANSWERED" }
  | { type: "TALKING_COMPLETE" }
  | { type: "MEET_SOMEONE_NEW" }
  | { type: "CANCEL_REQUEST" }
  | { type: "SESSION_LOCKED" };

export const studentMachine = setup({
  types: {
    context: {} as StudentContext,
    events: {} as StudentEvents,
  },
  actions: {
    setStudentInfo: assign({
      studentId: ({ event }) =>
        event.type === "JOIN_CLASS" ? event.studentId : null,
      classId: ({ event }) =>
        event.type === "JOIN_CLASS" ? event.classId : null,
      studentCode: ({ event }) =>
        event.type === "JOIN_CLASS" ? event.code : null,
      studentName: ({ event }) =>
        event.type === "JOIN_CLASS" ? event.name : "",
    }),
    setPartnerCode: assign({
      partnerCode: ({ event }) =>
        event.type === "ENTER_PARTNER_CODE" ? event.code : null,
    }),
    setPairInfo: assign({
      pairId: ({ event }) => (event.type === "PAIRED" ? event.pairId : null),
      partnerName: ({ event }) =>
        event.type === "PAIRED" ? event.partnerName : null,
      question: ({ event }) =>
        event.type === "PAIRED" ? event.question : null,
    }),
    setAnswer: assign({
      myAnswer: ({ event }) =>
        event.type === "SUBMIT_ANSWER" ? event.value : null,
    }),
    clearPair: assign({
      partnerCode: null,
      partnerName: null,
      pairId: null,
      question: null,
      myAnswer: null,
    }),
  },
  guards: {},
}).createMachine({
  id: "student",
  initial: "not_joined",
  context: {
    studentId: null,
    classId: null,
    studentCode: null,
    studentName: "",
    partnerCode: null,
    partnerName: null,
    pairId: null,
    question: null,
    myAnswer: null,
    talkingDuration: 45, // 45 seconds default
  },
  states: {
    not_joined: {
      on: {
        JOIN_CLASS: {
          target: "waiting_for_partner",
          actions: "setStudentInfo",
        },
      },
    },
    waiting_for_partner: {
      on: {
        ENTER_PARTNER_CODE: {
          actions: "setPartnerCode",
        },
        PAIRED: {
          target: "paired_intro",
          actions: "setPairInfo",
        },
        CANCEL_REQUEST: {
          actions: assign({ partnerCode: null }),
        },
        SESSION_LOCKED: "session_locked",
      },
    },
    paired_intro: {
      after: {
        1500: "question_active", // Auto-advance after 1.5s
      },
      on: {
        SESSION_LOCKED: "session_locked",
      },
    },
    question_active: {
      on: {
        SUBMIT_ANSWER: {
          actions: "setAnswer",
        },
        BOTH_ANSWERED: "talking_phase",
        SESSION_LOCKED: "session_locked",
      },
    },
    talking_phase: {
      on: {
        TALKING_COMPLETE: "wrap_up",
        SESSION_LOCKED: "session_locked",
      },
    },
    wrap_up: {
      on: {
        MEET_SOMEONE_NEW: {
          target: "waiting_for_partner",
          actions: "clearPair",
        },
        SESSION_LOCKED: "session_locked",
      },
    },
    session_locked: {
      type: "final",
    },
  },
});
