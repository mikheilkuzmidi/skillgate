import { keccak256, toBytes, type Hex } from "viem";

export type QuizQuestion = {
  prompt: string;
  options: string[];
  answer: number; // index of the correct option
};

export type Quiz = {
  title: string;
  questions: QuizQuestion[];
};

export const ZERO_HASH: Hex = `0x${"0".repeat(64)}`;

// Quizzes keyed by certificate type id. The ids match the order the deploy
// script seeds certificate types (1 = operator credential, 2 = engineer credential).
export const QUIZZES: Record<string, Quiz> = {
  "1": {
    title: "Forklift Safety L2",
    questions: [
      {
        prompt: "Before operating a silo forklift, you must first:",
        options: [
          "Skip the inspection to save time",
          "Complete a pre-operation inspection",
          "Disable the seatbelt alarm"
        ],
        answer: 1
      },
      {
        prompt: "When moving a loaded forklift down a ramp, you should:",
        options: [
          "Drive in reverse with the load on the upgrade side",
          "Drive forward as fast as possible",
          "Raise the forks to full height"
        ],
        answer: 0
      },
      {
        prompt: "Near pedestrians and blind corners, the safe rule is:",
        options: [
          "Maintain top speed",
          "Never use the horn",
          "Slow down and sound the horn"
        ],
        answer: 2
      }
    ]
  },
  "2": {
    title: "Solidity and Ethereum",
    questions: [
      {
        prompt: "A Solidity function that reads but does not modify state should be marked:",
        options: ["payable", "view", "indexed"],
        answer: 1
      },
      {
        prompt: "Gas on Ethereum is:",
        options: ["A fee paid to execute transactions", "A stablecoin", "Free for all writes"],
        answer: 0
      },
      {
        prompt: "Which pattern restricts a function to the contract's owner?",
        options: ["Marking it public", "An access-control modifier such as onlyOwner", "Declaring it constant"],
        answer: 1
      }
    ]
  }
};

// Canonical answer string for a quiz: the correct option indices joined by '-'.
// This exact string is hashed on-chain (keccak256 of its UTF-8 bytes) as the quiz gate.
export function answerKey(quiz: Quiz): string {
  return quiz.questions.map((question) => question.answer).join("-");
}

// The on-chain quizHash for a certificate type id (ZERO_HASH when no quiz exists).
export function quizHashForId(typeId: string): Hex {
  const quiz = QUIZZES[typeId];
  if (!quiz) return ZERO_HASH;
  return keccak256(toBytes(answerKey(quiz)));
}
