import { useEffect, useState } from "react";

const steps = [
  {
    kicker: "Step 1",
    title: "Connect on Sepolia",
    body: "Start with MetaMask on Ethereum Sepolia. The app uses your wallet for proposal creation, demo voting power, encrypted voting, and final reveal actions.",
    points: ["Use the wallet bar at the top.", "Switch network if prompted.", "No backend account is required."]
  },
  {
    kicker: "Step 2",
    title: "Claim voting power",
    body: "Each wallet can claim Boardroom Votes once. These demo votes are used as encrypted voting weight when you cast a ballot.",
    points: ["Claim once per wallet.", "Voting weight stays confidential.", "Gas is paid in Sepolia ETH."]
  },
  {
    kicker: "Step 3",
    title: "Open or create proposals",
    body: "Browse live governance packets or create your own from the dashboard with a custom start time and voting duration.",
    points: ["Proposal metadata is public.", "Choose duration before launch.", "Cards open into full detail pages."]
  },
  {
    kicker: "Step 4",
    title: "Cast an encrypted ballot",
    body: "Choose For, Against, or Abstain. The app prepares an encrypted vote locally before asking your wallet to submit the transaction.",
    points: ["Your ballot is not revealed.", "A wallet can vote once per proposal.", "Buttons lock after confirmation."]
  },
  {
    kicker: "Step 5",
    title: "Reveal only the final tally",
    body: "The proposal creator or deployer can close voting, prepare reveal, and publish the aggregate result without exposing individual ballots.",
    points: ["No live vote leakage.", "Final results are public.", "Useful for DAO, treasury, RWA, and compliance votes."]
  }
];

export function GuideOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dismissed = window.localStorage.getItem("boardroom-guide-dismissed-v2");
    if (!dismissed) setOpen(true);
  }, []);

  function closeGuide(remember = false) {
    if (remember) {
      window.localStorage.setItem("boardroom-guide-dismissed-v2", "1");
    }
    setOpen(false);
  }

  if (!open) {
    return (
      <button className="guide-trigger" onClick={() => setOpen(true)}>
        Product tour
      </button>
    );
  }

  const active = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <aside className="guide-backdrop" aria-label="Product tour">
      <div className="guide-card">
        <div className="guide-visual">
          <span className="guide-orb" />
          <div>
            <span className="mini-label">{active.kicker}</span>
            <h3>{active.title}</h3>
          </div>
          <button className="guide-close" onClick={() => closeGuide()} aria-label="Close guide">
            ×
          </button>
        </div>

        <p className="guide-copy">{active.body}</p>

        <div className="guide-points">
          {active.points.map((point) => (
            <span key={point}>{point}</span>
          ))}
        </div>

        <div className="guide-progress">
          {steps.map((item, index) => (
            <button
              key={item.title}
              className={index === step ? "guide-dot active" : "guide-dot"}
              onClick={() => setStep(index)}
              aria-label={`Open ${item.title}`}
            />
          ))}
        </div>

        <div className="guide-actions">
          <button className="secondary" onClick={() => closeGuide(true)}>
            Skip tour
          </button>
          <div>
            {step > 0 ? (
              <button className="secondary" onClick={() => setStep((current) => current - 1)}>
                Back
              </button>
            ) : null}
            <button onClick={() => (isLast ? closeGuide(true) : setStep((current) => current + 1))}>
              {isLast ? "Start using app" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
