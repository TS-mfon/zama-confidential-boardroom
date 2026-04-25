export type ProposalRecord = {
  id: number;
  title: string;
  description: string;
  category: string;
  proposer: string;
  startTime: number;
  endTime: number;
  finalized: boolean;
  revealRequested: boolean;
  result?: {
    forVotes: bigint;
    againstVotes: bigint;
    abstainVotes: bigint;
    passed: boolean;
    revealedAt: bigint;
  };
};
