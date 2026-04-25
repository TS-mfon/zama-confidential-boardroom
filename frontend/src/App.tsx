import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { toHex } from "viem";
import { Header } from "./components/Header";
import { ProposalList } from "./components/ProposalList";
import { ProposalDetail } from "./components/ProposalDetail";
import { GuideOverlay } from "./components/GuideOverlay";
import { getRelayer } from "./hooks/useRelayer";
import { useProposals } from "./hooks/useProposals";
import { boardroomAbi, tokenAbi } from "./lib/contracts";
import { env } from "./lib/env";

function futureWindow() {
  const now = Math.floor(Date.now() / 1000);
  return {
    startTime: BigInt(now + 60),
    endTime: BigInt(now + 60 * 60 * 24)
  };
}

export default function App() {
  const [selectedId, setSelectedId] = useState(1);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Treasury"
  });
  const [actionMessage, setActionMessage] = useState<string>("");
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const queryClient = useQueryClient();
  const { data = [], error } = useProposals();
  const { data: hasClaimedVotes } = useReadContract({
    address: env.boardroomTokenAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: "claimedDemoVotes",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) }
  });

  useEffect(() => {
    if (data.length > 0 && !data.some((proposal) => proposal.id === selectedId)) {
      setSelectedId(data[0].id);
    }
  }, [data, selectedId]);

  const selectedProposal = useMemo(
    () => data.find((proposal) => proposal.id === selectedId) ?? data[0],
    [data, selectedId]
  );

  async function ensureSepolia() {
    if (chainId !== sepolia.id) {
      await switchChainAsync({ chainId: sepolia.id });
    }
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["proposals"] });
  }

  async function claimVotes() {
    try {
      setActionMessage("");
      await ensureSepolia();
      const hash = await writeContractAsync({
        address: env.boardroomTokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: "claimDemoVotes"
      });
      setActionMessage(`Votes claimed. Tx: ${hash.slice(0, 10)}...`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Claim failed");
    }
  }

  async function createProposal() {
    try {
      if (!isConnected) {
        setActionMessage("Connect your wallet first.");
        return;
      }
      if (!form.title.trim() || !form.description.trim()) {
        setActionMessage("Add a title and description.");
        return;
      }
      setActionMessage("");
      await ensureSepolia();
      const { startTime, endTime } = futureWindow();
      const hash = await writeContractAsync({
        address: env.boardroomAddress as `0x${string}`,
        abi: boardroomAbi,
        functionName: "createProposal",
        args: [form.title.trim(), form.description.trim(), form.category.trim(), startTime, endTime]
      });
      setActionMessage(`Proposal submitted. Tx: ${hash.slice(0, 10)}...`);
      setForm({ title: "", description: "", category: form.category });
      setTimeout(() => {
        void refresh();
      }, 3500);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Proposal creation failed");
    }
  }

  async function castVote(proposalId: number, choice: 0 | 1 | 2) {
    try {
      if (!address) {
        setActionMessage("Connect your wallet first.");
        return;
      }
      setActionMessage("");
      await ensureSepolia();
      const relayer = await getRelayer();
      const encryptedInput = relayer.createEncryptedInput(env.boardroomAddress, address);
      encryptedInput.add8(choice);
      const proof = await encryptedInput.encrypt();
      const hash = await writeContractAsync({
        address: env.boardroomAddress as `0x${string}`,
        abi: boardroomAbi,
        functionName: "castVote",
        args: [BigInt(proposalId), toHex(proof.handles[0]), toHex(proof.inputProof)]
      });
      setActionMessage(`Encrypted vote sent. Tx: ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        void refresh();
      }, 3500);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Vote failed");
    }
  }

  async function finalizeProposal(proposalId: number) {
    try {
      setActionMessage("");
      await ensureSepolia();
      const hash = await writeContractAsync({
        address: env.boardroomAddress as `0x${string}`,
        abi: boardroomAbi,
        functionName: "finalizeProposal",
        args: [BigInt(proposalId)]
      });
      setActionMessage(`Proposal finalized. Tx: ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        void refresh();
      }, 3500);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Finalize failed");
    }
  }

  async function prepareReveal(proposalId: number) {
    try {
      setActionMessage("");
      await ensureSepolia();
      const hash = await writeContractAsync({
        address: env.boardroomAddress as `0x${string}`,
        abi: boardroomAbi,
        functionName: "prepareFinalReveal",
        args: [BigInt(proposalId)]
      });
      setActionMessage(`Reveal prepared. Tx: ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        void refresh();
      }, 3500);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Prepare reveal failed");
    }
  }

  return (
    <main className="shell">
      <GuideOverlay />
      <Header
        proposals={data}
        hasClaimedVotes={hasClaimedVotes}
        onClaimVotes={claimVotes}
        actionPending={isPending}
      />

      <section className="section split">
        <article className="card">
          <p className="eyebrow">Create</p>
          <h2>New proposal</h2>
          <p className="muted section-note">Launch a treasury, policy, or allocation vote from your wallet.</p>
          <div className="form-grid">
            <label>
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Treasury diversification"
              />
            </label>
            <label>
              <span>Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              >
                <option>Treasury</option>
                <option>Policy</option>
                <option>Risk</option>
                <option>Budget</option>
              </select>
            </label>
            <label className="full">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Move 15% of idle treasury into a lower-volatility yield strategy."
                rows={5}
              />
            </label>
          </div>
          <div className="button-row">
            <button onClick={createProposal} disabled={isPending}>Create proposal</button>
          </div>
          {actionMessage ? <p className="muted action-copy">{actionMessage}</p> : null}
        </article>

        <article className="card accent">
          <p className="eyebrow">How voting works</p>
          <h3>Boardroom Votes</h3>
          <ul className="list">
            <li>Claim demo voting power once.</li>
            <li>Create or open a proposal.</li>
            <li>Cast an encrypted ballot.</li>
            <li>Reveal only the final tally.</li>
          </ul>
          {error ? <p className="muted action-copy">Live proposal sync is temporarily unavailable.</p> : null}
        </article>
      </section>

      <ProposalList proposals={data} onSelect={setSelectedId} />
      <ProposalDetail
        proposals={data}
        selectedId={selectedProposal?.id ?? selectedId}
        actionPending={isPending}
        actionMessage={actionMessage}
        onVote={castVote}
        onFinalize={finalizeProposal}
        onPrepareReveal={prepareReveal}
      />
    </main>
  );
}
