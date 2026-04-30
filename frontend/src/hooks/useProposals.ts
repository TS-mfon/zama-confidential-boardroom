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

      const ids = Array.from({ length: Number(nextProposalId - 1n) }, (_, index) => BigInt(index + 1));

      return Promise.all(
        ids.map(async (id) => {
          const [proposal, result] = await Promise.all([
            client.readContract({
              address: env.boardroomAddress as `0x${string}`,
              abi: boardroomAbi,
              functionName: "getProposal",
              args: [id]
            }),
            client.readContract({
              address: env.resultAdapterAddress as `0x${string}`,
              abi: resultAbi,
              functionName: "getRevealedResult",
              args: [id]
            })
          ]);

          return {
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
          };
        })
      );
    }
  });
}
