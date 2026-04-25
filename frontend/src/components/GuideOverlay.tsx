import { useEffect, useState } from "react";

const steps = [
  {
    title: "Connect wallet",
    body: "Use your EVM wallet on Sepolia before you create proposals or cast encrypted votes."
  },
  {
    title: "Claim votes",
    body: "Claim demo Boardroom Votes once so you can participate in weighted governance."
  },
  {
    title: "Create proposals",
    body: "Proposal metadata is public so participants can review what is being voted on."
  },
  {
    title: "Vote privately",
    body: "Ballots and live tallies remain hidden until an authorized final reveal is prepared."
  }
];

export function GuideOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dismissed = window.localStorage.getItem("boardroom-guide-dismissed");
    if (!dismissed) setOpen(true);
  }, []);

  if (!open) {
    return (
      <button className="guide-trigger" onClick={() => setOpen(true)}>
        Open guided tour
      </button>
    );
  }

  const active = steps[step];
  return (
    <aside className="guide-overlay">
      <div className="guide-card">
        <p className="eyebrow">Operator guide</p>
        <h3>{active.title}</h3>
        <p className="muted">{active.body}</p>
        <div className="guide-progress">
          {steps.map((_, index) => (
            <span key={index} className={index === step ? "guide-dot active" : "guide-dot"} />
          ))}
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => setOpen(false)}>
            Hide
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep((current) => current + 1)}>Next step</button>
          ) : (
            <button
              onClick={() => {
                window.localStorage.setItem("boardroom-guide-dismissed", "1");
                setOpen(false);
              }}
            >
              Finish guide
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
