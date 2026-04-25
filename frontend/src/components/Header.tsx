import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import type { ProposalRecord } from "../lib/types";

type HeaderProps = {
  proposals: ProposalRecord[];
  hasClaimedVotes?: boolean;
  onClaimVotes: () => void;
  actionPending: boolean;
};

export function Header({ proposals, hasClaimedVotes, onClaimVotes, actionPending }: HeaderProps) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Private governance</p>
        <h1>Confidential Boardroom</h1>
        <p className="lede">
          Weighted voting for treasury councils and DAOs without exposing ballots or live tallies.
        </p>
        <div className="hero-strip">
          <div className="metric-panel">
            <span className="metric-label">Proposals</span>
            <strong>{proposals.length}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Voting</span>
            <strong>Encrypted</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Token</span>
            <strong>Boardroom Votes</strong>
          </div>
        </div>
      </div>
      <div className="card header-panel">
        <p className="eyebrow">Wallet</p>
        <h3>EVM wallet</h3>
        <p className="muted">Connect MetaMask, switch to Sepolia, claim demo voting power, then create or vote on proposals.</p>
        {!isConnected ? (
          <button onClick={() => connect({ connector: connectors[0] })} disabled={isPending || connectors.length === 0}>
            {isPending ? "Connecting..." : "Connect wallet"}
          </button>
        ) : (
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => switchChain({ chainId: sepolia.id })}
              disabled={chain?.id === sepolia.id}
            >
              {chain?.id === sepolia.id ? "On Sepolia" : "Switch network"}
            </button>
            <button onClick={onClaimVotes} disabled={actionPending || hasClaimedVotes}>
              {hasClaimedVotes ? "Votes claimed" : "Claim demo votes"}
            </button>
            <button className="secondary" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        )}
        <div className="status-card">
          <strong>{isConnected && address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "Wallet disconnected"}</strong>
          <span>{chain?.id === sepolia.id ? "Sepolia ready" : "Switch to Sepolia"}</span>
        </div>
      </div>
    </header>
  );
}
