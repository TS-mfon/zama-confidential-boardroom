import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPublicClient, encodeFunctionData, http, toHex } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { GuideOverlay } from "./components/GuideOverlay";
import { getRelayer, warmRelayer } from "./hooks/useRelayer";
import { useProposals } from "./hooks/useProposals";
import { boardroomAbi, tokenAbi } from "./lib/contracts";
import { env } from "./lib/env";
import type { ProposalRecord } from "./lib/types";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(env.sepoliaRpcUrl)
});

type Route =
  | { page: "home" }
  | { page: "proposals" }
  | { page: "proposal"; proposalId: number }
  | { page: "voting" }
  | { page: "about" }
  | { page: "dashboard" };

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type TxPhase = "idle" | "preparing" | "wallet" | "confirming";

function toDateTimeLocalValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function defaultProposalStart() {
  return toDateTimeLocalValue(new Date(Date.now() + 5 * 60_000));
}

function proposalWindow(startDateTime: string, durationHoursValue: string) {
  const startMillis = new Date(startDateTime).getTime();
  const durationHours = Number(durationHoursValue);

  if (!Number.isFinite(startMillis)) {
    throw new Error("Choose a valid start time.");
  }

  if (!Number.isFinite(durationHours) || durationHours < 0.25 || durationHours > 720) {
    throw new Error("Duration must be between 15 minutes and 30 days.");
  }

  const startTime = Math.floor(startMillis / 1000);
  const endTime = Math.floor(startTime + durationHours * 60 * 60);

  if (endTime <= startTime) {
    throw new Error("Proposal duration is too short.");
  }

  return {
    startTime: BigInt(startTime),
    endTime: BigInt(endTime)
  };
}

function parseRoute(pathname: string): Route {
  if (pathname === "/proposals") return { page: "proposals" };
  if (pathname === "/voting") return { page: "voting" };
  if (pathname === "/about") return { page: "about" };
  if (pathname === "/dashboard") return { page: "dashboard" };
  if (pathname.startsWith("/proposals/")) {
    const proposalId = Number(pathname.split("/")[2]);
    if (Number.isFinite(proposalId) && proposalId > 0) {
      return { page: "proposal", proposalId };
    }
  }
  return { page: "home" };
}

function formatDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getWalletErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "User rejected the transaction.";
  }

  if (lower.includes("wrong relayer url") || lower.includes("__wbindgen_malloc")) {
    return "Encryption service is still loading. Wait a few seconds and try again.";
  }

  if (lower.includes("insufficient funds")) {
    return "Insufficient Sepolia ETH for gas.";
  }

  if (lower.includes("already voted")) {
    return "This wallet already voted.";
  }

  if (lower.includes("already claimed")) {
    return "Voting power already claimed.";
  }

  if (lower.includes("proposal not active")) {
    return "Voting is not active for this proposal.";
  }

  if (lower.includes("unauthorized")) {
    return "Only the proposal creator or deployer can do this.";
  }

  if (message.length > 140) {
    return "Transaction failed. Check wallet and try again.";
  }

  return message || "Transaction failed.";
}

function proposalState(proposal: ProposalRecord) {
  const now = Math.floor(Date.now() / 1000);
  if (proposal.result) return "Revealed";
  if (proposal.finalized) return proposal.revealRequested ? "Reveal Ready" : "Finalized";
  if (now < proposal.startTime) return "Scheduled";
  if (now > proposal.endTime) return "Awaiting Close";
  return "Voting Live";
}

function isVotingActive(proposal: ProposalRecord) {
  const now = Math.floor(Date.now() / 1000);
  return now >= proposal.startTime && now <= proposal.endTime && !proposal.finalized;
}

function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(pathname: string) {
    if (window.location.pathname !== pathname) {
      window.history.pushState({}, "", pathname);
      setRoute(parseRoute(pathname));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return { route, navigate };
}

function NavLink({
  href,
  label,
  navigate
}: {
  href: string;
  label: string;
  navigate: (pathname: string) => void;
}) {
  const currentPath = window.location.pathname;
  const active = currentPath === href || (href === "/proposals" && currentPath.startsWith("/proposals/"));

  return (
    <a
      href={href}
      className={`nav-link ${active ? "active" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        navigate(href);
      }}
    >
      {label}
    </a>
  );
}

export default function App() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Treasury",
    startDateTime: defaultProposalStart(),
    durationHours: "24"
  });
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState<"default" | "error">("default");
  const [localVotedKeys, setLocalVotedKeys] = useState<Set<string>>(() => new Set());
  const { route, navigate } = useRoute();
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, switchChain } = useSwitchChain();
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const queryClient = useQueryClient();
  const { data = [] } = useProposals();
  const isTxPending = txPhase !== "idle";
  const minProposalStart = useMemo(() => toDateTimeLocalValue(new Date(Date.now() - 60_000)), []);

  const featuredProposal = data[0];
  const selectedProposal = useMemo(
    () => (route.page === "proposal" ? data.find((proposal) => proposal.id === route.proposalId) : undefined),
    [data, route]
  );

  const { data: hasClaimedVotes } = useReadContract({
    address: env.boardroomTokenAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: "claimedDemoVotes",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) }
  });

  const {
    data: alreadyVoted,
    isLoading: isVoteStatusLoading,
    isFetching: isVoteStatusFetching
  } = useReadContract({
    address: env.boardroomAddress as `0x${string}`,
    abi: boardroomAbi,
    functionName: "hasVoted",
    args:
      address && selectedProposal
        ? [BigInt(selectedProposal.id), address as `0x${string}`]
        : undefined,
    query: { enabled: Boolean(address && selectedProposal) }
  });

  const { data: boardroomOwner } = useReadContract({
    address: env.boardroomAddress as `0x${string}`,
    abi: boardroomAbi,
    functionName: "owner"
  });

  useEffect(() => {
    const warmupId = window.setTimeout(() => warmRelayer(), 1200);
    return () => window.clearTimeout(warmupId);
  }, []);

  useEffect(() => {
    if (route.page === "proposal" && !selectedProposal && data.length > 0) {
      navigate("/proposals");
    }
  }, [data.length, navigate, route.page, selectedProposal]);

  function setFeedback(message: string, tone: "default" | "error" = "default") {
    setActionMessage(message);
    setActionTone(tone);
  }

  async function ensureSepolia() {
    if (chainId !== sepolia.id) {
      await switchChainAsync({ chainId: sepolia.id });
    }
  }

  async function sendWalletTransaction(to: `0x${string}`, data: `0x${string}`) {
    if (!address) {
      throw new Error("Connect wallet first.");
    }

    const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;

    if (!ethereum) {
      throw new Error("MetaMask not detected.");
    }

    await ensureSepolia();
    setTxPhase("wallet");
    setFeedback("Confirm transaction in your wallet.");

    const hash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: address, to, data }]
    });

    setTxPhase("confirming");
    setFeedback("Waiting for confirmation...");

    const txHash = String(hash) as `0x${string}`;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      throw new Error("Transaction reverted.");
    }

    return txHash;
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["proposals"] });
  }

  async function claimVotes() {
    try {
      if (!address) {
        setFeedback("Connect wallet first.", "error");
        return;
      }

      setTxPhase("wallet");
      setFeedback("");
      const data = encodeFunctionData({
        abi: tokenAbi,
        functionName: "claimDemoVotes"
      });
      const hash = await sendWalletTransaction(env.boardroomTokenAddress as `0x${string}`, data);
      setFeedback(`Voting power claimed. ${hash.slice(0, 10)}...`);
    } catch (error) {
      setFeedback(getWalletErrorMessage(error), "error");
    } finally {
      setTxPhase("idle");
    }
  }

  async function createProposal() {
    try {
      if (!isConnected) {
        setFeedback("Connect wallet first.", "error");
        return;
      }
      if (!form.title.trim() || !form.description.trim()) {
        setFeedback("Add title and description.", "error");
        return;
      }

      setTxPhase("wallet");
      setFeedback("");
      const { startTime, endTime } = proposalWindow(form.startDateTime, form.durationHours);
      const data = encodeFunctionData({
        abi: boardroomAbi,
        functionName: "createProposal",
        args: [form.title.trim(), form.description.trim(), form.category.trim(), startTime, endTime]
      });
      const hash = await sendWalletTransaction(env.boardroomAddress as `0x${string}`, data);

      setFeedback(`Proposal created. ${hash.slice(0, 10)}...`);
      setForm({
        title: "",
        description: "",
        category: "Treasury",
        startDateTime: defaultProposalStart(),
        durationHours: "24"
      });
      setTimeout(() => {
        void refresh();
      }, 3500);
      navigate("/proposals");
    } catch (error) {
      setFeedback(getWalletErrorMessage(error), "error");
    } finally {
      setTxPhase("idle");
    }
  }

  async function castVote(proposalId: number, choice: 0 | 1 | 2) {
    try {
      if (!address) {
        setFeedback("Connect wallet first.", "error");
        return;
      }

      setTxPhase("preparing");
      setFeedback("Preparing encrypted ballot...");
      await ensureSepolia();
      const relayer = await getRelayer();
      const encryptedInput = relayer.createEncryptedInput(env.boardroomAddress, address);
      encryptedInput.add8(choice);
      const proof = await encryptedInput.encrypt();

      const data = encodeFunctionData({
        abi: boardroomAbi,
        functionName: "castVote",
        args: [BigInt(proposalId), toHex(proof.handles[0]), toHex(proof.inputProof)]
      });
      const hash = await sendWalletTransaction(env.boardroomAddress as `0x${string}`, data);
      const voteKey = `${proposalId}:${address.toLowerCase()}`;

      setLocalVotedKeys((current) => {
        const next = new Set(current);
        next.add(voteKey);
        return next;
      });
      setFeedback(`Encrypted ballot sent. ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        void refresh();
      }, 3500);
    } catch (error) {
      setFeedback(getWalletErrorMessage(error), "error");
    } finally {
      setTxPhase("idle");
    }
  }

  async function finalizeProposal(proposalId: number) {
    try {
      setTxPhase("wallet");
      setFeedback("");
      const data = encodeFunctionData({
        abi: boardroomAbi,
        functionName: "finalizeProposal",
        args: [BigInt(proposalId)]
      });
      const hash = await sendWalletTransaction(env.boardroomAddress as `0x${string}`, data);
      setFeedback(`Proposal finalized. ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        void refresh();
      }, 3500);
    } catch (error) {
      setFeedback(getWalletErrorMessage(error), "error");
    } finally {
      setTxPhase("idle");
    }
  }

  async function prepareReveal(proposalId: number) {
    try {
      setTxPhase("wallet");
      setFeedback("");
      const data = encodeFunctionData({
        abi: boardroomAbi,
        functionName: "prepareFinalReveal",
        args: [BigInt(proposalId)]
      });
      const hash = await sendWalletTransaction(env.boardroomAddress as `0x${string}`, data);
      setFeedback(`Reveal prepared. ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        void refresh();
      }, 3500);
    } catch (error) {
      setFeedback(getWalletErrorMessage(error), "error");
    } finally {
      setTxPhase("idle");
    }
  }

  async function revealResults(proposalId: number) {
    try {
      setTxPhase("preparing");
      setFeedback("Preparing final tally...");
      await ensureSepolia();
      const [forHandle, againstHandle, abstainHandle] = await queryClient.fetchQuery({
        queryKey: ["reveal-handles", proposalId],
        queryFn: async () => {
          return publicClient.readContract({
            address: env.boardroomAddress as `0x${string}`,
            abi: boardroomAbi,
            functionName: "getRevealHandles",
            args: [BigInt(proposalId)]
          });
        }
      });

      const relayer = await getRelayer();
      const results = await relayer.publicDecrypt([forHandle, againstHandle, abstainHandle]);

      const data = encodeFunctionData({
        abi: boardroomAbi,
        functionName: "submitFinalReveal",
        args: [BigInt(proposalId), results.abiEncodedClearValues, results.decryptionProof]
      });
      const hash = await sendWalletTransaction(env.boardroomAddress as `0x${string}`, data);

      setFeedback(`Result revealed. ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        void refresh();
      }, 3500);
    } catch (error) {
      setFeedback(getWalletErrorMessage(error), "error");
    } finally {
      setTxPhase("idle");
    }
  }

  const canManageSelectedProposal = Boolean(
    selectedProposal &&
      address &&
      (address.toLowerCase() === selectedProposal.proposer.toLowerCase() ||
        address.toLowerCase() === String(boardroomOwner).toLowerCase())
  );
  const selectedVoteKey = address && selectedProposal ? `${selectedProposal.id}:${address.toLowerCase()}` : "";
  const hasVotedSelectedProposal = Boolean(alreadyVoted || (selectedVoteKey && localVotedKeys.has(selectedVoteKey)));
  const isCheckingVoteStatus = Boolean(
    address && selectedProposal && (isVoteStatusLoading || (isVoteStatusFetching && alreadyVoted === undefined))
  );

  function voteButtonLabel(defaultLabel: string) {
    if (!address) return "Connect wallet";
    if (isCheckingVoteStatus) return "Checking...";
    if (hasVotedSelectedProposal) return "Already voted";
    if (txPhase === "preparing") return "Encrypting...";
    if (txPhase === "wallet") return "Confirm wallet";
    if (txPhase === "confirming") return "Confirming...";
    return defaultLabel;
  }

  function voteButtonDisabled(proposal: ProposalRecord) {
    return isTxPending || !address || isCheckingVoteStatus || hasVotedSelectedProposal || !isVotingActive(proposal);
  }

  return (
    <main className="app-shell">
      <GuideOverlay />

      <header className="topbar">
        <a
          href="/"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
        >
          <span className="brand-mark">CB</span>
          <span className="brand-copy">
            <strong>Confidential Boardroom</strong>
            <small>Private governance for live treasuries</small>
          </span>
        </a>

        <nav className="nav">
          <NavLink href="/" label="Home" navigate={navigate} />
          <NavLink href="/proposals" label="Proposals" navigate={navigate} />
          <NavLink href="/voting" label="Voting" navigate={navigate} />
          <NavLink href="/about" label="About" navigate={navigate} />
          <NavLink href="/dashboard" label="Dashboard" navigate={navigate} />
        </nav>
      </header>

      <section className="wallet-band panel">
        <div>
          <span className="mini-label">Wallet</span>
          <h2>{isConnected && address ? shortenAddress(address) : "Connect MetaMask"}</h2>
          <p>{chainId === sepolia.id ? "Sepolia ready" : "Use Ethereum Sepolia for every action."}</p>
        </div>
        <div className="wallet-band-actions">
          {!isConnected ? (
            <button
              onClick={() => {
                const connector = connectors[0];
                if (connector) connect({ connector });
              }}
              disabled={connectPending || connectors.length === 0}
            >
              {connectPending ? "Connecting..." : "Connect wallet"}
            </button>
          ) : (
            <>
              <button className="secondary" onClick={() => switchChain({ chainId: sepolia.id })} disabled={chainId === sepolia.id}>
                {chainId === sepolia.id ? "Sepolia connected" : "Switch network"}
              </button>
              <button onClick={claimVotes} disabled={isTxPending || Boolean(hasClaimedVotes)}>
                {hasClaimedVotes ? "Votes claimed" : isTxPending ? "Working..." : "Claim voting power"}
              </button>
              <button className="secondary" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </section>

      {actionMessage ? (
        <section className={`feedback ${actionTone === "error" ? "error" : ""}`}>
          <span>{actionMessage}</span>
        </section>
      ) : null}

      {route.page === "home" ? (
        <>
          <section className="hero panel">
            <div className="hero-copy">
              <span className="mini-label">Confidential governance</span>
              <h1>Weighted voting without leaking strategy.</h1>
              <p className="hero-text">
                Create public proposals, cast encrypted ballots, and reveal only the final aggregate result.
              </p>
              <div className="hero-actions">
                <button onClick={() => navigate("/proposals")}>Explore proposals</button>
                <button className="secondary" onClick={() => navigate("/voting")}>How it works</button>
              </div>
            </div>

            <div className="hero-card-grid">
              <article className="mini-card">
                <span className="mini-label">Live proposals</span>
                <strong>{data.length}</strong>
                <p>Read from Sepolia.</p>
              </article>
              <article className="mini-card">
                <span className="mini-label">Vote token</span>
                <strong>Boardroom Votes</strong>
                <p>Claim once.</p>
              </article>
              <article className="mini-card">
                <span className="mini-label">Reveal style</span>
                <strong>Final tally only</strong>
                <p>No live leak.</p>
              </article>
            </div>
          </section>

          <section className="content-grid">
            <article className="panel">
              <div className="section-head">
                <div>
                  <span className="mini-label">Featured proposal</span>
                  <h2>{featuredProposal ? featuredProposal.title : "No proposal yet"}</h2>
                </div>
                {featuredProposal ? <span className="state-pill">{proposalState(featuredProposal)}</span> : null}
              </div>
              <p className="section-copy">
                {featuredProposal
                  ? featuredProposal.description
                  : "Open the dashboard to create the first proposal after claiming demo voting power."}
              </p>
              {featuredProposal ? (
                <div className="meta-row">
                  <span>{featuredProposal.category}</span>
                  <span>{formatDate(featuredProposal.endTime)}</span>
                  <span>{shortenAddress(featuredProposal.proposer)}</span>
                </div>
              ) : null}
              <div className="hero-actions">
                <button onClick={() => navigate(featuredProposal ? `/proposals/${featuredProposal.id}` : "/dashboard")}>
                  {featuredProposal ? "Open proposal" : "Open dashboard"}
                </button>
              </div>
            </article>

            <article className="panel accent-panel">
              <span className="mini-label">Why it matters</span>
              <h2>Private signals. Public outcomes.</h2>
              <div className="feature-list">
                <div>
                  <strong>Encrypted ballots</strong>
                  <p>Voting intent stays hidden during the active window.</p>
                </div>
                <div>
                  <strong>Weighted governance</strong>
                  <p>Each wallet votes with confidential demo balances.</p>
                </div>
                <div>
                  <strong>Controlled reveal</strong>
                  <p>Only the aggregate result becomes public.</p>
                </div>
              </div>
            </article>
          </section>
        </>
      ) : null}

      {route.page === "proposals" ? (
        <section className="page-stack">
          <section className="page-hero">
            <span className="mini-label">Proposals</span>
            <h1>Live board agenda</h1>
            <p>Open a proposal packet to vote privately or manage the reveal flow.</p>
          </section>

          <section className="proposal-grid">
            {data.length === 0 ? (
              <article className="panel empty-panel">
                <h3>No proposals yet</h3>
                <p>Create the first governance packet from the dashboard.</p>
              </article>
            ) : (
              data.map((proposal) => (
                <article className="panel proposal-card" key={proposal.id}>
                  <div className="section-head">
                    <span className="tag">{proposal.category}</span>
                    <span className="state-pill">{proposalState(proposal)}</span>
                  </div>
                  <h3>{proposal.title}</h3>
                  <p>{proposal.description}</p>
                  <div className="meta-row">
                    <span>{formatDate(proposal.startTime)}</span>
                    <span>{formatDate(proposal.endTime)}</span>
                  </div>
                  <button onClick={() => navigate(`/proposals/${proposal.id}`)}>Open proposal</button>
                </article>
              ))
            )}
          </section>
        </section>
      ) : null}

      {route.page === "proposal" && selectedProposal ? (
        <section className="page-stack">
          <section className="page-hero">
            <span className="mini-label">Proposal detail</span>
            <h1>{selectedProposal.title}</h1>
            <p>{selectedProposal.description}</p>
          </section>

          <section className="content-grid">
            <article className="panel">
              <div className="section-head">
                <span className="tag">{selectedProposal.category}</span>
                <span className="state-pill">{proposalState(selectedProposal)}</span>
              </div>

              <div className="detail-grid">
                <div>
                  <span className="mini-label">Proposer</span>
                  <strong>{shortenAddress(selectedProposal.proposer)}</strong>
                </div>
                <div>
                  <span className="mini-label">Start</span>
                  <strong>{formatDate(selectedProposal.startTime)}</strong>
                </div>
                <div>
                  <span className="mini-label">End</span>
                  <strong>{formatDate(selectedProposal.endTime)}</strong>
                </div>
                <div>
                  <span className="mini-label">Vote token</span>
                  <strong>Boardroom Votes</strong>
                </div>
              </div>

              <div className="action-grid">
                <button
                  onClick={() => castVote(selectedProposal.id, 1)}
                  disabled={voteButtonDisabled(selectedProposal)}
                >
                  {voteButtonLabel("Vote For")}
                </button>
                <button
                  className="secondary"
                  onClick={() => castVote(selectedProposal.id, 0)}
                  disabled={voteButtonDisabled(selectedProposal)}
                >
                  {voteButtonLabel("Vote Against")}
                </button>
                <button
                  className="secondary"
                  onClick={() => castVote(selectedProposal.id, 2)}
                  disabled={voteButtonDisabled(selectedProposal)}
                >
                  {voteButtonLabel("Abstain")}
                </button>
              </div>

              <div className="action-grid secondary-actions">
                <button
                  className="secondary"
                  onClick={() => finalizeProposal(selectedProposal.id)}
                  disabled={isTxPending || selectedProposal.finalized || !canManageSelectedProposal}
                >
                  Close Voting
                </button>
                <button
                  className="secondary"
                  onClick={() => prepareReveal(selectedProposal.id)}
                  disabled={isTxPending || !selectedProposal.finalized || selectedProposal.revealRequested || !canManageSelectedProposal}
                >
                  Prepare Reveal
                </button>
                <button
                  className="secondary"
                  onClick={() => revealResults(selectedProposal.id)}
                  disabled={isTxPending || !selectedProposal.revealRequested || Boolean(selectedProposal.result) || !canManageSelectedProposal}
                >
                  Reveal Result
                </button>
              </div>
            </article>

            <article className="panel accent-panel">
              <span className="mini-label">Result</span>
              <h2>{selectedProposal.result ? "Final tally" : "Private until reveal"}</h2>
              {selectedProposal.result ? (
                <div className="result-grid">
                  <div>
                    <span className="mini-label">For</span>
                    <strong>{selectedProposal.result.forVotes.toString()}</strong>
                  </div>
                  <div>
                    <span className="mini-label">Against</span>
                    <strong>{selectedProposal.result.againstVotes.toString()}</strong>
                  </div>
                  <div>
                    <span className="mini-label">Abstain</span>
                    <strong>{selectedProposal.result.abstainVotes.toString()}</strong>
                  </div>
                </div>
              ) : (
                <p className="section-copy">Ballots and live tallies remain encrypted while voting is active.</p>
              )}
              <p className="section-copy">
                {hasVotedSelectedProposal
                  ? "This wallet has already submitted a ballot for this proposal."
                  : "Claim voting power once, then cast an encrypted ballot from this page."}
              </p>
              {!canManageSelectedProposal && selectedProposal.finalized ? (
                <p className="section-copy">Only the proposal creator or deployer can finalize, prepare, and publish the final reveal.</p>
              ) : null}
            </article>
          </section>
        </section>
      ) : null}

      {route.page === "voting" ? (
        <section className="page-stack">
          <section className="page-hero">
            <span className="mini-label">Voting flow</span>
            <h1>How voting works</h1>
            <p>The product separates every step so users can understand the flow before signing anything.</p>
          </section>

          <section className="timeline-grid">
            {[
              ["Claim voting power", "Mint one demo allocation of Boardroom Votes."],
              ["Open a proposal", "Review the public packet and voting window."],
              ["Cast encrypted ballot", "Submit a private for, against, or abstain vote."],
              ["Reveal final tally", "Only the final aggregate result becomes public."]
            ].map(([title, copy], index) => (
              <article className="panel timeline-card" key={title}>
                <span className="timeline-index">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </section>

          <section className="content-grid">
            <article className="panel">
              <span className="mini-label">Vote token</span>
              <h2>Boardroom Votes</h2>
              <p className="section-copy">
                This demo uses Boardroom Votes. Each wallet claims once, then uses that confidential balance as voting power.
              </p>
            </article>
            <article className="panel accent-panel">
              <span className="mini-label">Quick start</span>
              <h2>Use the app</h2>
              <ul className="clean-list">
                <li>Connect MetaMask on Sepolia.</li>
                <li>Claim voting power in Dashboard.</li>
                <li>Open or create a proposal.</li>
                <li>Vote from the proposal page.</li>
              </ul>
            </article>
          </section>
        </section>
      ) : null}

      {route.page === "about" ? (
        <section className="page-stack">
          <section className="page-hero">
            <span className="mini-label">About</span>
            <h1>Built for treasury councils</h1>
            <p>Confidential Boardroom is designed for DAOs, committees, and syndicates that need private weighted voting on public proposals.</p>
          </section>

          <section className="content-grid">
            <article className="panel">
              <span className="mini-label">Public data</span>
              <h2>Proposal packet</h2>
              <p className="section-copy">Titles, descriptions, categories, proposers, and voting windows stay visible.</p>
            </article>
            <article className="panel">
              <span className="mini-label">Private data</span>
              <h2>Ballot + weight</h2>
              <p className="section-copy">Vote choices, weights, and interim counts remain encrypted until the end.</p>
            </article>
            <article className="panel accent-panel">
              <span className="mini-label">Use cases</span>
              <h2>Live governance</h2>
              <p className="section-copy">Treasury shifts, grant approvals, budgets, and policy updates all fit this model.</p>
            </article>
          </section>
        </section>
      ) : null}

      {route.page === "dashboard" ? (
        <section className="page-stack">
          <section className="page-hero">
            <span className="mini-label">Dashboard</span>
            <h1>Manage your session</h1>
            <p>Claim demo voting power, create governance packets, and move into live voting from one place.</p>
          </section>

          <section className="content-grid">
            <article className="panel">
              <div className="section-head">
                <div>
                  <span className="mini-label">Voting power</span>
                  <h2>Claim demo votes</h2>
                </div>
                <span className="state-pill">{hasClaimedVotes ? "Claimed" : "Available"}</span>
              </div>
              <p className="section-copy">Each wallet can claim one demo allocation of Boardroom Votes on Sepolia.</p>
              <button onClick={claimVotes} disabled={isTxPending || Boolean(hasClaimedVotes)}>
                {hasClaimedVotes ? "Voting power claimed" : isTxPending ? "Working..." : "Claim voting power"}
              </button>
            </article>

            <article className="panel accent-panel">
              <span className="mini-label">Create proposal</span>
              <h2>Launch a board vote</h2>
              <div className="form-grid">
                <label>
                  <span>Title</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Treasury shift"
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
                    placeholder="Move a portion of idle treasury into a lower-volatility yield strategy."
                    rows={5}
                  />
                </label>
                <label>
                  <span>Voting starts</span>
                  <input
                    type="datetime-local"
                    value={form.startDateTime}
                    min={minProposalStart}
                    onChange={(event) => setForm((current) => ({ ...current, startDateTime: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Duration</span>
                  <select
                    value={form.durationHours}
                    onChange={(event) => setForm((current) => ({ ...current, durationHours: event.target.value }))}
                  >
                    <option value="0.25">15 minutes</option>
                    <option value="1">1 hour</option>
                    <option value="6">6 hours</option>
                    <option value="24">24 hours</option>
                    <option value="72">3 days</option>
                    <option value="168">7 days</option>
                    <option value="720">30 days</option>
                  </select>
                </label>
              </div>
              <button onClick={createProposal} disabled={isTxPending}>
                {isTxPending ? "Working..." : "Create proposal"}
              </button>
            </article>
          </section>
        </section>
      ) : null}
    </main>
  );
}
