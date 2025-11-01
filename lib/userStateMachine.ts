import { setup, assign } from "xstate";

export type UserContext = {
  userId: string | null;
  roomId: string | null;
  userCode: number | null;
  avatar: string;
  groupId: string | null;
  groupMembers: Array<{
    id: string;
    avatar: string;
    code: number;
    isMe?: boolean;
  }>;
  question: {
    text: string;
    optionA: string;
    optionB: string;
    followUp: string;
  } | null;
  myAnswer: string | null;
  talkingDuration: number; // seconds
  pendingRequestId: string | null;
};

export type UserEvents =
  | { type: "JOIN_ROOM"; userId: string; roomId: string; code: number; avatar: string }
  | { type: "SEND_REQUEST"; targetId: string }
  | { type: "CANCEL_REQUEST" }
  | { type: "JOINED_GROUP"; groupId: string; members: any[]; question: any }
  | { type: "SUBMIT_ANSWER"; value: string }
  | { type: "ALL_ANSWERED" }
  | { type: "TALKING_COMPLETE" }
  | { type: "LEAVE_GROUP" }
  | { type: "SESSION_LOCKED" };

export const userMachine = setup({
  types: {
    context: {} as UserContext,
    events: {} as UserEvents,
  },
  actions: {
    setUserInfo: assign({
      userId: ({ event }) =>
        event.type === "JOIN_ROOM" ? event.userId : null,
      roomId: ({ event }) =>
        event.type === "JOIN_ROOM" ? event.roomId : null,
      userCode: ({ event }) =>
        event.type === "JOIN_ROOM" ? event.code : null,
      avatar: ({ event }) =>
        event.type === "JOIN_ROOM" ? event.avatar : "",
    }),
    setPendingRequest: assign({
      pendingRequestId: ({ event }) =>
        event.type === "SEND_REQUEST" ? event.targetId : null,
    }),
    clearPendingRequest: assign({
      pendingRequestId: null,
    }),
    setGroupInfo: assign({
      groupId: ({ event }) =>
        event.type === "JOINED_GROUP" ? event.groupId : null,
      groupMembers: ({ event }) =>
        event.type === "JOINED_GROUP" ? event.members : [],
      question: ({ event }) =>
        event.type === "JOINED_GROUP" ? event.question : null,
    }),
    setAnswer: assign({
      myAnswer: ({ event }) =>
        event.type === "SUBMIT_ANSWER" ? event.value : null,
    }),
    clearGroup: assign({
      groupId: null,
      groupMembers: [],
      question: null,
      myAnswer: null,
    }),
  },
  guards: {},
}).createMachine({
  id: "user",
  initial: "not_joined",
  context: {
    userId: null,
    roomId: null,
    userCode: null,
    avatar: "",
    groupId: null,
    groupMembers: [],
    question: null,
    myAnswer: null,
    talkingDuration: 45, // 45 seconds default
    pendingRequestId: null,
  },
  states: {
    not_joined: {
      on: {
        JOIN_ROOM: {
          target: "browsing",
          actions: "setUserInfo",
        },
      },
    },
    browsing: {
      on: {
        SEND_REQUEST: {
          target: "waiting_for_acceptance",
          actions: "setPendingRequest",
        },
        JOINED_GROUP: {
          target: "question_active",
          actions: "setGroupInfo",
        },
        SESSION_LOCKED: "session_locked",
      },
    },
    waiting_for_acceptance: {
      on: {
        CANCEL_REQUEST: {
          target: "browsing",
          actions: "clearPendingRequest",
        },
        JOINED_GROUP: {
          target: "question_active",
          actions: ["clearPendingRequest", "setGroupInfo"],
        },
        SESSION_LOCKED: "session_locked",
      },
    },
    question_active: {
      on: {
        SUBMIT_ANSWER: {
          actions: "setAnswer",
        },
        ALL_ANSWERED: "talking_phase",
        LEAVE_GROUP: {
          target: "browsing",
          actions: "clearGroup",
        },
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
        LEAVE_GROUP: {
          target: "browsing",
          actions: "clearGroup",
        },
        SESSION_LOCKED: "session_locked",
      },
    },
    session_locked: {
      type: "final",
    },
  },
});
