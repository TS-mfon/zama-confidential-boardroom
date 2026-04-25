import type { ProposalRecord } from "../lib/types";

type ProposalListProps = {
  proposals: ProposalRecord[];
  onSelect: (id: number) => void;
};

export function ProposalList({ proposals, onSelect }: ProposalListProps) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Proposals</p>
          <h2>Live board agenda</h2>
          <p className="muted section-note">All rows are read directly from Sepolia.</p>
        </div>
        <p className="muted compact-copy">Open any packet</p>
      </div>
      {proposals.length === 0 ? (
        <article className="card empty-state">
          <h3>No proposals yet</h3>
          <p className="muted">Create one and it will appear here automatically.</p>
        </article>
      ) : null}
      <div className="grid">
        {proposals.map((proposal) => (
          <article className="card" key={proposal.id}>
            <span className="badge">{proposal.category}</span>
            <h3>{proposal.title}</h3>
            <p className="muted">{proposal.description}</p>
            <p className="muted section-note">{proposal.finalized ? "Finalized" : "Open"} • {proposal.revealRequested ? "Reveal ready" : "Reveal pending"}</p>
            <button onClick={() => onSelect(proposal.id)}>View proposal</button>
          </article>
        ))}
      </div>
    </section>
  );
}
