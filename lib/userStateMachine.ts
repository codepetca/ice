import { setup, assign } from "xstate";

export type UserContext = {
  userId: string | null;
  roomId: string | null;
  userCode: number | null;
  displayName: string;
  avatar: string;
  groupId: string | null;
  groupMembers: Array<{
    userId: string;
    displayName: string;
    avatar: string;
    code: number;
    isMe?: boolean;
  }>;
  // Name matching phase
  nameChoices: Record<string, string[]>; // avatarId -> [name1, name2, name3]
  nameSelections: Record<string, string>; // avatarId -> selectedName
  completedNameMatching: string[]; // userIds who completed
  // WYR phase
  question: {
    text: string;
    optionA: string;
    optionB: string;
    followUp: string;
  } | null;
  myAnswer: string | null;
  // Phase 2 fields
  gameId: string | null;
  currentRoundNumber: number | null;
  gameQuestion: string | null;
  myVote: string | null;
  myScore: number;
};

export type UserEvents =
  | { type: "JOIN_ROOM"; userId: string; roomId: string; code: number; displayName: string; avatar: string }
  | { type: "WAITING_FOR_ROUND" }
  | { type: "START_NAME_MATCHING"; groupId: string; members: any[]; nameChoices: Record<string, string[]> }
  | { type: "SELECT_NAME"; avatarId: string; selectedName: string }
  | { type: "ADVANCE_TO_WYR"; question: any }
  | { type: "SUBMIT_ANSWER"; value: string }
  | { type: "ROUND_END" }
  | { type: "SESSION_LOCKED" }
  | { type: "START_PHASE2"; gameId: string; roundNumber: number; questionText: string }
  | { type: "SUBMIT_VOTE"; choice: string }
  | { type: "ROUND_REVEALED" }
  | { type: "NEXT_ROUND"; roundNumber: number; questionText: string }
  | { type: "GAME_COMPLETE" }
  | { type: "ROOM_RESET" };

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
      displayName: ({ event }) =>
        event.type === "JOIN_ROOM" ? event.displayName : "",
      avatar: ({ event }) =>
        event.type === "JOIN_ROOM" ? event.avatar : "",
    }),
    startNameMatching: assign({
      groupId: ({ event }) =>
        event.type === "START_NAME_MATCHING" ? event.groupId : null,
      groupMembers: ({ event }) =>
        event.type === "START_NAME_MATCHING" ? event.members : [],
      nameChoices: ({ event }) =>
        event.type === "START_NAME_MATCHING" ? event.nameChoices : {},
      nameSelections: {},
      completedNameMatching: [],
    }),
    selectName: assign({
      nameSelections: ({ context, event }) => {
        if (event.type === "SELECT_NAME") {
          return {
            ...context.nameSelections,
            [event.avatarId]: event.selectedName,
          };
        }
        return context.nameSelections;
      },
    }),
    advanceToWyr: assign({
      question: ({ event }) =>
        event.type === "ADVANCE_TO_WYR" ? event.question : null,
    }),
    setAnswer: assign({
      myAnswer: ({ event }) =>
        event.type === "SUBMIT_ANSWER" ? event.value : null,
    }),
    clearGroup: assign({
      groupId: null,
      groupMembers: [],
      nameChoices: {},
      nameSelections: {},
      completedNameMatching: [],
      question: null,
      myAnswer: null,
    }),
    // Phase 2 actions
    startPhase2: assign({
      gameId: ({ event }) =>
        event.type === "START_PHASE2" ? event.gameId : null,
      currentRoundNumber: ({ event }) =>
        event.type === "START_PHASE2" ? event.roundNumber : null,
      gameQuestion: ({ event }) =>
        event.type === "START_PHASE2" ? event.questionText : null,
      myVote: null,
    }),
    setVote: assign({
      myVote: ({ event }) =>
        event.type === "SUBMIT_VOTE" ? event.choice : null,
    }),
    nextRound: assign({
      currentRoundNumber: ({ event }) =>
        event.type === "NEXT_ROUND" ? event.roundNumber : null,
      gameQuestion: ({ event }) =>
        event.type === "NEXT_ROUND" ? event.questionText : null,
      myVote: null,
    }),
    resetPhase2: assign({
      gameId: null,
      currentRoundNumber: null,
      gameQuestion: null,
      myVote: null,
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
    displayName: "",
    avatar: "",
    groupId: null,
    groupMembers: [],
    nameChoices: {},
    nameSelections: {},
    completedNameMatching: [],
    question: null,
    myAnswer: null,
    // Phase 2 context
    gameId: null,
    currentRoundNumber: null,
    gameQuestion: null,
    myVote: null,
    myScore: 0,
  },
  states: {
    not_joined: {
      on: {
        JOIN_ROOM: {
          target: "waiting_for_round_start",
          actions: "setUserInfo",
        },
      },
    },
    waiting_for_round_start: {
      on: {
        START_NAME_MATCHING: {
          target: "name_matching",
          actions: "startNameMatching",
        },
        SESSION_LOCKED: {
          target: "session_locked",
          actions: "clearGroup",
        },
      },
    },
    name_matching: {
      on: {
        SELECT_NAME: {
          actions: "selectName",
        },
        ADVANCE_TO_WYR: {
          target: "question_active",
          actions: "advanceToWyr",
        },
        ROUND_END: {
          target: "waiting_for_round_start",
          actions: "clearGroup",
        },
        SESSION_LOCKED: {
          target: "session_locked",
          actions: "clearGroup",
        },
      },
    },
    question_active: {
      on: {
        SUBMIT_ANSWER: {
          actions: "setAnswer",
        },
        ROUND_END: {
          target: "waiting_for_round_start",
          actions: "clearGroup",
        },
        SESSION_LOCKED: {
          target: "session_locked",
          actions: "clearGroup",
        },
      },
    },
    session_locked: {
      on: {
        START_PHASE2: {
          target: "phase2_voting",
          actions: "startPhase2",
        },
      },
    },
    phase2_voting: {
      on: {
        SUBMIT_VOTE: {
          target: "phase2_waiting",
          actions: "setVote",
        },
        ROOM_RESET: {
          target: "waiting_for_round_start",
          actions: ["resetPhase2", "clearGroup"],
        },
      },
    },
    phase2_waiting: {
      on: {
        NEXT_ROUND: {
          target: "phase2_voting",
          actions: "nextRound",
        },
        ROOM_RESET: {
          target: "waiting_for_round_start",
          actions: ["resetPhase2", "clearGroup"],
        },
      },
    },
    phase2_reveal: {
      on: {
        NEXT_ROUND: {
          target: "phase2_voting",
          actions: "nextRound",
        },
        GAME_COMPLETE: "phase2_complete",
        ROOM_RESET: {
          target: "waiting_for_round_start",
          actions: ["resetPhase2", "clearGroup"],
        },
      },
    },
    phase2_complete: {
      on: {
        ROOM_RESET: {
          target: "waiting_for_round_start",
          actions: ["resetPhase2", "clearGroup"],
        },
      },
    },
  },
});
