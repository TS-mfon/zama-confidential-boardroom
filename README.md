# Confidential Boardroom

Confidential Boardroom is a private weighted-governance protocol for DAOs, treasury councils, and committee-style decision making. Proposal metadata is public, while voting weight, ballot selection, and live tallies remain encrypted until the final aggregate reveal.

## Governance Problem

Most governance systems leak too much. Public vote choice enables coercion, whale-shadowing, strategic signaling, and treasury front-running long before a proposal closes.

## Why Zama

Zama gives the protocol-level confidentiality primitives needed to keep vote choice and tallies encrypted while still allowing onchain weighted computation and a verifiable final reveal.

## What Is Public Vs Private

- Public: proposal title, proposer, category, timing, final aggregate outcome after reveal.
- Private: voting weight, vote choice, intermediate tally, individual ballot forever.

## Architecture

- `contracts/`: confidential voting token, boardroom, and result reveal adapter.
- `frontend/`: proposal list, vote flow, final reveal, and committee-grade UX.
- `docs/`: architecture, threat model, economics, and demo script.

## Sepolia Deployment

- **Live App URL**: `https://confidential-boardroom-app.vercel.app`
- `ResultRevealAdapter`: `0x45119A32ca6C4d67424401dA92Abe4EC6c83f8Ce`
- `BoardroomToken`: `0x191B0d8E70b7866e834821D8DB2bC37780767538`
- `ConfidentialBoardroom`: `0x2Da12543C8389C4C70Ae5560c57830bE0C84B2C9`

### Deployment Transactions

- Adapter: `0x25dff4b893f6f38c6a3cd3a39be1cd5ad6de44b9e0bc8fd07f353a3216bbc656`
- Token: `0x4aaead039444a655d2af89880b4424db0d10672f53c60014e6734a7d6aa3171c`
- Boardroom: `0xa38c88dcab4fb11ed54be67aa2e4b66cd6c1c019991269a834efde4c658fc6af`
- Live proposal seed: `0x57eb9aa01bba312c93b283e00c044efd1f0d39071a42fc7e23fd3ae5d6b46a2f`

## Fee Model

- Proposal creation fee in v1.
- Hosted governance instances and premium committee tooling in later versions.

## Local Development

1. Install dependencies in `frontend` and the required Zama contract dependencies for `contracts`.
2. Configure `.env` with Sepolia RPC and deployed contract addresses.
3. Start the frontend with `npm run dev` inside `frontend`.
4. Deploy contracts and update the frontend address config.

## Demo Flow

1. Connect an EVM wallet on Sepolia.
2. Claim demo `Boardroom Votes`.
3. Create or open a treasury proposal.
4. Cast encrypted votes without exposing live tallies.
5. Finalize and prepare the final aggregate reveal.

## Roadmap To Protocol

- Hosted private governance instances for DAOs and RWA operators.
- Proposal templates and committee policy packs.
- Governance analytics around revealed aggregate outcomes only.
