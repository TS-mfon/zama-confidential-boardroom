export const boardroomAbi = [
  {
    type: "function",
    name: "nextProposalId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "getProposal",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { type: "uint256" },
      { type: "string" },
      { type: "string" },
      { type: "string" },
      { type: "address" },
      { type: "uint64" },
      { type: "uint64" },
      { type: "bool" },
      { type: "bool" }
    ]
  },
  {
    type: "function",
    name: "createProposal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "category", type: "string" },
      { name: "startTime", type: "uint64" },
      { name: "endTime", type: "uint64" }
    ],
    outputs: [{ name: "proposalId", type: "uint256" }]
  },
  {
    type: "function",
    name: "castVote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "encryptedChoice", type: "bytes32" },
      { name: "inputProof", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "finalizeProposal",
    stateMutability: "nonpayable",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "prepareFinalReveal",
    stateMutability: "nonpayable",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "submitFinalReveal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "cleartexts", type: "bytes" },
      { name: "decryptionProof", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "getRevealHandles",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "forVotesHandle", type: "bytes32" },
      { name: "againstVotesHandle", type: "bytes32" },
      { name: "abstainVotesHandle", type: "bytes32" }
    ]
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "hasVoted",
    stateMutability: "view",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "voter", type: "address" }
    ],
    outputs: [{ type: "bool" }]
  }
] as const;

export const resultAbi = [
  {
    type: "function",
    name: "getRevealedResult",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "forVotes", type: "uint64" },
          { name: "againstVotes", type: "uint64" },
          { name: "abstainVotes", type: "uint64" },
          { name: "passed", type: "bool" },
          { name: "revealedAt", type: "uint64" }
        ]
      }
    ]
  }
] as const;

export const tokenAbi = [
  {
    type: "function",
    name: "claimDemoVotes",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "claimedDemoVotes",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "bool" }]
  }
] as const;
