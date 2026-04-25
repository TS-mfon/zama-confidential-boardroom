import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { env } from "../lib/env";
import { boardroomAbi, resultAbi } from "../lib/contracts";
import type { ProposalRecord } from "../lib/types";

const client = createPublicClient({
  chain: sepolia,
  transport: http(env.sepoliaRpcUrl)
});

export function useProposals() {
  return useQuery<ProposalRecord[]>({
    queryKey: ["proposals"],
    queryFn: async () => {
      const nextProposalId = await client.readContract({
        address: env.boardroomAddress as `0x${string}`,
        abi: boardroomAbi,
        functionName: "nextProposalId"
      });

      const proposals: ProposalRecord[] = [];
      for (let id = 1n; id < nextProposalId; id += 1n) {
        const proposal = await client.readContract({
          address: env.boardroomAddress as `0x${string}`,
          abi: boardroomAbi,
          functionName: "getProposal",
          args: [id]
        });

        const result = await client.readContract({
          address: env.resultAdapterAddress as `0x${string}`,
          abi: resultAbi,
          functionName: "getRevealedResult",
          args: [id]
        });

        proposals.push({
          id: Number(proposal[0]),
          title: proposal[1],
          description: proposal[2],
          category: proposal[3],
          proposer: proposal[4],
          startTime: Number(proposal[5]),
          endTime: Number(proposal[6]),
          finalized: proposal[7],
          revealRequested: proposal[8],
          result: result.revealedAt > 0n ? result : undefined
        });
      }

      return proposals;
    }
  });
}
