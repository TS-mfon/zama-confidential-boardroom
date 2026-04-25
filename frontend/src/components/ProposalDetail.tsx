import { useMemo } from "react";
import type { ProposalRecord } from "../lib/types";

type ProposalDetailProps = {
  proposals: ProposalRecord[];
  selectedId: number;
  actionPending: boolean;
  actionMessage?: string;
  onVote: (proposalId: number, choice: 0 | 1 | 2) => void;
  onFinalize: (proposalId: number) => void;
  onPrepareReveal: (proposalId: number) => void;
};

function formatTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString();
}

export function ProposalDetail({
  proposals,
  selectedId,
  actionPending,
  actionMessage,
  onVote,
  onFinalize,
  onPrepareReveal
}: ProposalDetailProps) {
  const proposal = useMemo(
    () => proposals.find((entry) => entry.id === selectedId) ?? proposals[0],
    [proposals, selectedId]
  );

  if (!proposal) {
    return null;
  }

  return (
    <section className="section split">
      <article className="card">
        <p className="eyebrow">Packet</p>
        <h2>{proposal.title}</h2>
        <p>{proposal.description}</p>
        <ul className="list">
          <li>Category: {proposal.category}</li>
          <li>Proposer: {proposal.proposer.slice(0, 8)}...{proposal.proposer.slice(-6)}</li>
          <li>Starts: {formatTime(proposal.startTime)}</li>
          <li>Ends: {formatTime(proposal.endTime)}</li>
          <li>Status: {proposal.finalized ? "Finalized" : "Active"}</li>
          <li>Reveal: {proposal.revealRequested ? "Prepared" : "Pending"}</li>
        </ul>
        <p className="muted section-note">Voting uses Boardroom Votes. Individual ballots remain private.</p>
        <div className="button-row vote-row">
          <button onClick={() => onVote(proposal.id, 1)} disabled={actionPending}>Vote For</button>
          <button className="secondary" onClick={() => onVote(proposal.id, 0)} disabled={actionPending}>Vote Against</button>
          <button className="secondary" onClick={() => onVote(proposal.id, 2)} disabled={actionPending}>Abstain</button>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => onFinalize(proposal.id)} disabled={actionPending}>Finalize</button>
          <button className="secondary" onClick={() => onPrepareReveal(proposal.id)} disabled={actionPending}>Prepare reveal</button>
        </div>
        {actionMessage ? <p className="muted action-copy">{actionMessage}</p> : null}
      </article>
      <article className="card accent">
        <p className="eyebrow">Result</p>
        <h3>{proposal.result ? "Final tally" : "Private until reveal"}</h3>
        <p className="muted">
          {proposal.result
            ? `For ${proposal.result.forVotes.toString()} • Against ${proposal.result.againstVotes.toString()} • Abstain ${proposal.result.abstainVotes.toString()}`
            : "During active proposals, live tallies remain hidden by design."}
        </p>
        <p className="muted">Only final aggregate results become public. Individual ballots never do.</p>
      </article>
    </section>
  );
}
