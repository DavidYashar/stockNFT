# Google Stock NFT — Project Design Report

Version 1.0 — June 8, 2026
Chain: Ethereum Mainnet
Status: Design Phase (Pre-Development)

---

## Table of Contents

1. Executive Summary
2. Product Overview
3. How It Works
4. Smart Contract Architecture
5. Contract-by-Contract Specification
6. Money Flow and Treasury Mechanics
7. Interest System
8. Google Share Redemption
9. Metadata and NFT Design
10. Backend Infrastructure
11. External Integrations
12. Risk Analysis
13. Key Contract Addresses
14. Development Roadmap

---

## 1. Executive Summary

Google Stock NFT is a tokenized certificate product built on Ethereum. It gives everyday users fractional exposure to Alphabet Class A (GOOGL) stock without needing a brokerage account, a six-figure bank balance, or any knowledge of traditional finance.

Here is the basic idea: a user pays USDC to mint an NFT. That NFT represents a proportional claim on actual Google shares — specifically, Ondo Finance's GOOGLon token, which is a regulated, fully-backed ERC-20 token that tracks GOOGL stock on-chain. On top of that, a portion of every mint goes into an Aave DeFi deposit that generates yield, which gets paid back to NFT holders as weekly interest.

The treasury operates in two phases. During the mint phase, 80% of the money collected sits in a vault, waiting. The other 20% gets deposited into Aave every four hours to start earning yield right away. Meanwhile, every time an NFT changes hands on the secondary market, the platform collects a 10% royalty. That royalty money slowly builds up.

Once minting ends — either because all 10,000 NFTs sold out, or because the platform decides to stop and burn the remaining supply — the system waits for the accumulated royalties to match the 20% that was already spent on Aave. When that happens, everything fires at once: the 80% pool plus the royalties buy all the Google shares in a single Uniswap trade. From that moment on, every NFT holder has a fixed, verifiable claim on real GOOGLon sitting in the vault.

Users earn 2% annual interest, paid out weekly, which comes from the Aave yield. And once the Google purchase is complete, any holder can redeem their NFT for actual GOOGLon tokens — sent directly to their wallet after a 48-hour waiting period and a 5% management fee.

---

## 2. Product Overview

### What It Is

A collection of 10,000 semi-fungible NFTs (ERC-1155 standard) on Ethereum mainnet. Each one is a digital certificate proving fractional ownership of Google stock.

### Key Numbers

- Total supply: 10,000 NFTs
- Minimum mint price: 10 USDC
- Users can pay more than the minimum to get proportionally more Google shares
- Mint currency: USDC (Circle's regulated stablecoin)
- Royalty on secondary sales: 10%, paid to the platform deployer
- Annual yield for holders: 2% of their original principal, paid weekly
- Google share redemption fee: 5% of the share value
- Redemption waiting period: 48 hours

### What Users Get

- Fractional ownership of Alphabet Class A stock through GOOGLon
- 2% annual interest paid every week, just for holding the NFT
- The ability to sell the NFT anytime on any marketplace that supports ERC-1155
- After the Google share purchase happens, the right to redeem the NFT for actual GOOGLon tokens sent to their wallet
- Full on-chain transparency — every treasury action, purchase, and distribution is verifiable

### What Users Do Not Get

- Voting rights in Alphabet Inc. — this is economic exposure only, not direct share ownership
- A brokerage account or stock certificate from a transfer agent
- The ability to redeem before the one-time Google purchase is complete
- Interest payments after selling the NFT (the new owner gets them instead)

### Early Stop Option

If the mint does not go as planned — say only a few thousand NFTs sell and the market loses interest — the platform can stop minting at any time and burn whatever is left of the 10,000 supply. The NFTs that were already minted are unaffected. The treasury still proceeds with the same logic: wait for royalties to cover the gap, then buy Google shares.

---

## 3. How It Works

### Phase 1 — Minting and Accumulation

A user comes to the platform, connects their wallet, and decides how much USDC they want to put in. The minimum is 10 USDC. If they pay 10, they get a claim on roughly 0.027 Google shares (assuming GOOGL is around 365 dollars). If they pay 100, they get ten times that.

The moment they mint, their USDC goes into the TreasuryVault contract. That contract immediately splits the money: 80% goes into a holding pool for the future Google purchase, and 20% goes into a DeFi allocation pool.

Every four hours, an automated bot sweeps whatever has accumulated in the 20% pool and deposits it into Aave v3. Aave gives us aUSDC in return — a yield-bearing token that continuously grows in value. Right now, Aave is paying about 3.19% APY on USDC deposits.

The 80% pool just sits there. It does nothing until the trigger fires.

While all this is happening, NFTs are being freely traded on secondary markets. Every trade generates a 10% royalty that flows back to the platform. That royalty money keeps piling up in the PlatformManager contract.

Also during this phase, anyone holding an NFT is earning 2% annual interest — tracked per-NFT, every second. They can claim it weekly. When an NFT is sold, the old owner's pending interest is settled, and the new owner starts fresh from that moment.

### Phase 2 — Mint Ends

The mint phase wraps up in one of two ways: either every single one of the 10,000 NFTs finds a buyer, or the platform administrator decides to stop the mint and burn whatever is left unsold.

At this point, no new money enters the 80% pool. The 20% DeFi pool keeps doing its thing in Aave — earning yield, funding interest payments — but no more deposits go in. The system now has a fixed target for the Google purchase: 100% of all the USDC that minters paid.

But there is a problem: 20% of that money already went to Aave. So only 80% is available for Google shares. The missing 20% has to come from somewhere else — and that somewhere is the royalty fees from secondary trades.

### Phase 3 — The Trigger

The trigger condition is simple: total royalties accumulated so far must be at least 20% of total mint principal.

Once that becomes true, the platform administrator calls the trigger. In a single transaction:

- The 80% pool moves from TreasuryVault to StockVault
- All the accumulated royalties move from PlatformManager to StockVault
- StockVault combines them and executes one big Uniswap V4 trade: USDC to GOOGLon
- The GOOGLon lands in the StockVault
- Every NFT is assigned a fixed, proportional share of the total GOOGLon based on how much USDC the original minter paid

From this moment forward, redemption is live. Any NFT holder can burn their NFT and receive GOOGLon in return.

### Final State

After everything settles, the treasury holds exactly two things:

- GOOGLon in the StockVault — backing every NFT's share claim, redeemable on demand
- aUSDC in the DeFiVault — sitting in Aave, generating yield forever, funding the 2% weekly interest

### A Quick Math Example

Say 5,000 NFTs are minted at exactly 10 USDC each. That is 50,000 USDC total.

- 80% pool: 40,000 USDC (held)
- 20% pool: 10,000 USDC (already in Aave)
- Gap to fill: 10,000 USDC

The system needs 10,000 USDC in royalties before it can buy Google shares. If secondary trading is active and each trade generates meaningful royalties, this could take days or weeks. If trading is slow, it takes longer. There is no time limit — the trigger simply waits.

When the trigger fires: 40,000 plus 10,000 equals 50,000 USDC buys GOOGLon. Each of the 5,000 NFTs gets exactly 1/5000th of the total.

---

## 4. Smart Contract Architecture

The system is built from five smart contracts that each handle a specific job. They talk to each other through a clean set of permissions — most contracts can only be called by specific other contracts, which limits the blast radius if something goes wrong.

Here is the layout:

    User -- mints NFT --> GoogleStockNFT (ERC-1155)
    GoogleStockNFT -- sends USDC to --> TreasuryVault (80% hold / 20% DeFi + Aave)
    TreasuryVault -- on trigger --> StockVault (Uniswap swap + redemption)
    TreasuryVault -- weekly --> InterestDistributor (2% APR per NFT)
    User -- trades NFT --> Marketplace (OpenSea, Blur, etc.)
    Marketplace -- 10% royalty to --> PlatformManager (admin, trigger logic)
    User -- claims interest --> InterestDistributor
    User -- redeems shares --> StockVault

### Who Can Call What

GoogleStockNFT talks to TreasuryVault when minting, and to InterestDistributor when NFTs change hands.

TreasuryVault receives money from GoogleStockNFT and handles everything: 80/20 split, Aave deposits every 4 hours, weekly yield harvest to InterestDistributor, and releasing pool80 to StockVault on trigger. All USDC stays in this one wallet — pool80 and pool20 are just internal accounting.

StockVault receives USDC from TreasuryVault and PlatformManager, swaps it for GOOGLon on Uniswap, holds the GOOGLon, and processes user redemptions with the 48-hour delay.

PlatformManager is the admin hub. It controls the trigger, can stop the mint, can burn unminted supply, and holds the royalty money until the trigger fires.

InterestDistributor tracks every NFT's accrued interest, processes weekly claims, and settles old owners when NFTs are transferred.

---

## 5. Contract-by-Contract Specification

### 5.1 GoogleStockNFT (ERC-1155)

This is the NFT contract that users interact with directly. It extends OpenZeppelin's ERC-1155 implementation and adds royalty support through EIP-2981.

State it keeps track of:

- How many NFTs have been minted so far, and what the maximum is (10,000)
- Whether minting is currently active
- For each token ID: how much USDC the original minter paid, what the GOOGL price was at that moment, and when it happened
- For each token ID: the IRYS transaction ID that points to the mutable metadata
- For each token ID: the timestamp of the last interest claim, used to calculate how much interest has accrued since then

What it can do:

Mint. The user specifies how much USDC they want to pay. The contract verifies it is at least 10 USDC (in the token's 6-decimal format, that is 10,000,000 units). It takes the USDC from the user's wallet and sends it straight to TreasuryVault. Then it mints one ERC-1155 token to the user, records all the relevant data, and fires off the metadata upload to IRYS.

Token URI. Returns the URL where the NFT's metadata lives. It points to IRYS using a mutable reference, so the same URL always shows the latest version even after owner changes.

Royalty Info. EIP-2981 compliance. When a marketplace asks what royalty should be paid on this sale, the contract answers: 10% to the platform deployer.

Before Transfer Hook. Every time an NFT moves from one wallet to another, this hook fires automatically. Any unclaimed interest from the old owner is forfeited back to the vault. The new owner's interest clock does not start immediately — they must wait 48 hours before interest begins accruing.

Stop Mint and Burn Unminted. Callable only by PlatformManager. These functions halt new minting and reduce the maximum supply, permanently removing unsold NFTs from existence.

### 5.2 TreasuryVault

This contract is the financial plumbing. It receives all the money from mints and makes sure it goes to the right places in the right proportions.

State it keeps track of:

- The two pools: pool80 (for Google) and pool20 (for DeFi)
- The last time the DeFi sweep happened
- The sweep interval (4 hours)

What it can do:

Receive USDC. Called by GoogleStockNFT during mint. It takes the incoming amount and splits it: 80% to pool80, 20% to pool20. Simple math, no rounding tricks.

Sweep DeFi. Only the platform admin can call this after 4 hours have passed since the last sweep. It takes everything in pool20 and sends it to DeFiVault, then resets pool20 to zero and updates the timestamp.

Release Google Funds. Only PlatformManager can call this, and only when the trigger condition is met. It sends everything in pool80 to StockVault and resets pool80 to zero.

### 5.3 DeFiVault

This contract manages the Aave integration. It is the bridge between user mint money and the DeFi yield that funds interest payments.

State it keeps track of:

- The Aave Pool contract address and the USDC and aUSDC token addresses
- The total amount of USDC that has been deposited (the principal)
- When the last yield harvest happened

What it can do:

Deposit to Aave. Called by TreasuryVault during the 4-hour sweep. It approves USDC spending to Aave, then calls Aave's supply function. Aave mints aUSDC and sends it back to this contract. The principal counter goes up.

Harvest and Distribute. This is the weekly operation. It checks how much the aUSDC is currently worth in USDC by reading Aave's liquidityIndex. It subtracts the original principal to find the accrued yield. Then it calculates how much is owed to users — 2% per year divided by 52 weeks, applied to the total principal. If the accrued yield covers it, it withdraws exactly that amount from Aave (burning some aUSDC, receiving USDC) and sends it to InterestDistributor so users can claim. Any yield above the 2% stays in Aave as a buffer.

Current Balance. A view function that multiplies the aUSDC balance by Aave's current exchange rate to get the USDC-equivalent value.

Emergency Withdraw. Only PlatformManager. Pulls everything out of Aave. This exists for the worst-case scenario — if Aave is compromised or the platform needs to migrate.

The 2% annual interest paid to users comes from the 20% DeFi allocation of their investment. Users understand that the 20% portion of what they put in is deployed to Aave, generates yield, and is paid back to them as weekly interest. The full mechanics, including the fact that Google share redemption only becomes available after the loyalty fees have covered the 20% gap, will be laid out in the project whitepaper.

### 5.4 StockVault

This is the contract that holds the actual Google shares (GOOGLon) and handles user redemptions.

State it keeps track of:

- How much GOOGLon the vault holds in total
- Whether the one-time Google purchase has happened yet
- For each NFT, how much GOOGLon it is entitled to
- For each NFT, whether a redemption has been requested and when
- The redemption delay (48 hours) and fee (5%)

What it can do:

Execute Google Purchase. Only PlatformManager can trigger this. It receives USDC, routes it through Uniswap V4 to buy GOOGLon, and records the total received. Then it calculates each NFT's share proportionally — an NFT whose minter paid 100 USDC out of a 50,000 total pool would get 0.2% of the GOOGLon. After this function runs, redemption is live.

Request Redemption. Any NFT holder can call this. It burns the NFT — permanently removing it from circulation — and records the current timestamp. The user now has a pending redemption that matures in 48 hours. They cannot cancel.

Claim Redemption. After 48 hours have passed, the user calls this. The contract calculates the 5% fee, sends 95% of the GOOGLon to the user's wallet, and sends 5% to the platform wallet. The NFT is already gone at this point.

Why the 48-hour delay? It prevents flash-loan attacks where someone could borrow an NFT, redeem it instantly, and exploit price differences. It also gives the platform time to ensure sufficient GOOGLon liquidity. This is a standard pattern for asset-backed redemptions.

### 5.5 PlatformManager

This is the administrative control center. Only the platform owner can call most of its functions.

State it keeps track of:

- How much royalty money has accumulated from secondary trades
- The total USDC that all minters paid (for calculating the 20% gap)
- Whether the Google purchase trigger has already fired

What it can do:

Receive Loyalty. Called automatically when NFT royalties are paid. It adds the royalty to the accumulated total and checks whether the trigger condition has been met. If royalties now equal or exceed 20% of the total mint principal, the purchase is ready to fire.

Stop Mint and Burn. The admin calls this to end the mint phase early. It tells GoogleStockNFT to stop accepting new mints and to burn whatever supply remains. After this, the trigger logic starts watching for the royalty threshold.

Trigger Google Purchase. This is the big red button. It requires that minting has ended AND accumulated royalties cover the 20% gap. When called, it moves all the money to StockVault and tells it to execute the Uniswap trade. This function can only be called once — after it fires, the trigger is permanently disabled.

Update Fees. Allows changing the royalty percentage, redemption fee, or interest rate. Changes only affect future transactions, not existing NFTs.

Pause and Unpause. Emergency controls. When paused, no mints, trades, redemptions, or claims can happen. Everything resumes when unpaused.

### 5.6 InterestDistributor

This contract manages the 2% APR interest system. It tracks every NFT individually and handles the complexities of ownership changes.

State it keeps track of:

- The annual interest rate (2%)
- How much USDC is currently available for interest claims
- For each NFT, how much claimable interest the current owner has accumulated

What it can do:

Fund Distribution. Called weekly by DeFiVault after harvesting Aave yield. It adds USDC to the interest pool so users can claim.

Get Pending Interest. A view function anyone can call. It multiplies the NFT's principal by 2%, divides by the number of seconds in a year, and multiplies by how many seconds have passed since the last claim. This gives the exact amount of interest accrued down to the second.

Claim Interest. Called by the current NFT holder. It calculates the pending amount, verifies the pool has enough to cover it, transfers the USDC, and resets the timestamp on the NFT contract. Emits an event so the frontend can update.

Settle on Transfer. Called by GoogleStockNFT whenever an NFT changes hands. Any unclaimed interest belonging to the old owner is forfeited and returned to the vault. The new owner's interest clock is set to the current time plus a 48-hour waiting period — interest only begins accruing after those 48 hours have passed.

---

## 6. Money Flow and Treasury Mechanics

### Where Every Dollar Goes

Let us trace a single 10 USDC mint from start to finish.

The user sends 10 USDC. It lands in TreasuryVault. The contract immediately splits it: 8 USDC to pool80, 2 USDC to pool20.

The 8 USDC sits in pool80. It just waits. It earns nothing, does nothing. It is patient money.

The 2 USDC sits in pool20. Within four hours (or sooner if someone calls the sweep function), it moves to DeFiVault and gets deposited into Aave. Aave gives us roughly 2 aUSDC in return. That aUSDC starts earning interest at about 3.19% per year — roughly 0.0061% per week.

Every week, DeFiVault withdraws a tiny sliver of that yield — enough to pay 2% annual interest on the 2 USDC DeFi principal. That is about 0.04 USDC per year, or roughly 0.00077 USDC per week. It sends this to InterestDistributor, and the NFT holder can claim it.

Meanwhile, if the NFT is ever traded, 10% of the sale price goes to PlatformManager as a royalty. That money piles up.

When minting ends and the accumulated royalties finally reach 2 USDC (which is 20% of the original 10), the trigger fires. The 8 USDC from pool80 plus the 2 USDC from royalties — together 10 USDC — goes to StockVault and buys GOOGLon.

The user's NFT now has a claim on exactly 10 USDC worth of GOOGLon, bought at whatever the market price was at that moment.

And the 2 aUSDC in Aave? It stays there forever, earning yield, funding future interest payments for whoever holds the NFT.

### Trigger Math, Step by Step

Here is a more realistic scenario. Say 5,000 NFTs sell at exactly 10 USDC each.

- Total mint principal = 50,000 USDC
- pool80 = 40,000 USDC
- pool20 = 10,000 USDC (already earning in Aave)
- Google purchase needs 50,000 USDC total
- The gap is 10,000 USDC

The system waits until 10,000 USDC in royalties has been collected. If each NFT trade generates, on average, a 0.50 USDC royalty (say the NFT sells for 5 USDC on the secondary market), then it takes about 20,000 trades to hit the trigger. In an active market, that could be weeks. In a slow market, months.

There is no rush. The trigger is patient, just like the 80% pool.

---

## 7. Interest System

### How Interest Accrues

Every NFT earns 2% per year on the 20% DeFi portion of the original mint payment — not the full amount. So for a 10 USDC mint, the interest-bearing principal is 2 USDC, and 2% of that is 0.04 USDC per year. This accrues continuously — every single second — once the 48-hour waiting period has passed.

For a 10 USDC NFT: once the 48-hour wait is over, interest accrues on the 2 USDC DeFi principal at about 0.00000000127 USDC per second. Over a week, it adds up to about 0.00077 USDC. Over a year, exactly 0.04 USDC.

The GoogleStockNFT contract stores a timestamp for each token ID showing when interest can begin accruing — this is set to the current time plus 48 hours whenever the NFT changes hands. To figure out how much is pending, the contract checks whether the waiting period has passed, then calculates from that point forward.

### Claiming Interest

Once a week, the DeFiVault harvests yield from Aave and funds the InterestDistributor pool. Any NFT holder can then call the claim function and receive their USDC instantly. There is no minimum amount and no penalty for claiming more or less often.

### What Happens When an NFT Is Sold

When Alice sells her NFT to Bob, the transfer triggers a hook in the NFT contract. Any interest Alice earned but did not claim before the sale is forfeited — it goes back to the vault. Bob's 48-hour waiting period begins at the moment of transfer. He will start earning interest only after those 48 hours have passed. The lesson for every holder: claim your interest before you sell, and be aware that new purchases come with a two-day wait before interest kicks in.

### Where the Money Comes From

The 2% interest is paid from the 20% DeFi allocation of each user's investment. That 20% is deposited into Aave, where it earns yield (currently around 3.19% APY on USDC). Each week, a portion of that yield is withdrawn and distributed to NFT holders as their 2% annual interest.

Users know going in that the 20% of their mint payment is what funds their weekly interest — and that the Google shares can only be redeemed after the loyalty fees from secondary trading have filled the gap. These details will be fully documented in the project whitepaper.

---

## 8. Google Share Redemption

### The Redemption Process

Once the one-time Google purchase is complete, any NFT holder can redeem their certificate for actual GOOGLon tokens.

The process has two steps, separated by a mandatory 48-hour waiting period.

Step one: the holder calls the redeem function on StockVault. Their NFT is immediately burned — it ceases to exist. A 48-hour countdown begins. The amount of GOOGLon they are entitled to is locked in at that moment.

Step two: after 48 hours have passed, the holder calls the claim function. The contract deducts 5% from their GOOGLon allocation and sends the remaining 95% to their wallet. The 5% goes to the platform as a management fee.

The user now holds real GOOGLon in their wallet — an ERC-20 token they can hold, trade on Uniswap, or use in any DeFi protocol that supports it.

### Why 48 Hours

Three reasons. First, security: a delay prevents someone from using a flash loan to borrow an NFT, redeem it instantly, and extract value in a single transaction. Second, liquidity: it gives the platform time to ensure there is enough GOOGLon available if many redemptions happen at once. Third, fairness: it prevents front-running where someone sees a redemption about to happen and tries to profit from the expected price impact.

### Fee Justification

The 5% fee covers the operational costs of the platform — gas for the Uniswap purchase, keeper bot infrastructure, IRYS metadata updates, and general maintenance. It also aligns incentives: the platform earns more when the product is successful and redemptions are processed smoothly.

---

## 9. Metadata and NFT Design

### Where Metadata Lives

NFT metadata is stored on IRYS, a permanent data layer built on top of Arweave. Unlike IPFS, which requires active pinning to keep files available, Arweave stores data permanently with a single upfront payment. And unlike on-chain storage, which costs gas for every byte, IRYS is cheap and can handle large JSON payloads.

It is important to understand what goes where. IRYS handles the certificate display — the NFT image, the owner address shown in wallets, the Google shares amount, and the mint price. These are for visual presentation only. Every piece of financial logic lives on-chain in the smart contracts: the 48-hour interest clock, the last claim timestamp, whether a holder is eligible, forfeiture on transfer, and the actual USDC transfers. The contract never reads IRYS. It only writes a URL pointing there so wallets and marketplaces can display the certificate correctly.

Each NFT gets a mutable reference URL. This is the clever part: the URL never changes, but the content it points to can be updated. IRYS calls this a "mutable reference." You upload an initial transaction, get a transaction ID, and then any future upload with a special tag linking back to that ID becomes the new "latest version" for the same URL.

The token URI looks like this: https://gateway.irys.xyz/mutable/ABC123...

When the NFT is first minted, the backend uploads the initial metadata. When the NFT is traded and the owner changes, the backend uploads an updated version with the new owner address. Same URL, fresh data. Marketplaces and wallets always see the current owner in the metadata.

### What the Metadata Contains

Every NFT's metadata is a JSON object with a name, description, image link, and a list of attributes. The attributes are what make these NFTs special.

Static attributes — never change after minting:

- Google Shares (GOOGLon): the fractional share amount, like 0.0274
- USDC Paid at Mint: how much the minter put in, like 10.00
- GOOGL Price at Mint: the market price at that exact moment, like 365.36
- Mint Date: when the NFT was created

Dynamic attribute — updated on every transfer:

- Current Owner: the Ethereum address currently holding the NFT

The image is the same for all NFTs — a certificate-style design showing the Google Stock NFT branding. Individual NFT numbers or share amounts are rendered from the on-chain data by the frontend.

### Why Not On-Chain

Storing full JSON metadata on-chain would cost roughly 10 to 50 dollars in gas per update, and every owner change would require an update. With 10,000 NFTs potentially trading many times each, that cost becomes prohibitive. IRYS costs a fraction of a cent per upload and provides the same permanence guarantees.

---

## 10. Backend Infrastructure

### Automated Bots

Three keeper bots run on a Node.js backend to keep the system moving.

The DeFi Sweeper runs every four hours. It checks if enough time has passed since the last sweep and, if so, calls TreasuryVault.sweepDeFi(). This is a public function, so technically anyone could call it — the bot just ensures it happens reliably.

The Yield Harvester runs once a week. It checks the Aave liquidityIndex, calculates how much yield has accrued, verifies it covers the 2% weekly obligation, withdraws the exact amount needed from Aave, and funds the InterestDistributor. If the yield is insufficient (because Aave APY dropped below 2%), it logs a warning and distributes whatever is available.

The Trigger Monitor runs every ten minutes. It checks whether minting has ended and whether accumulated royalties have crossed the 20% threshold. If both conditions are met, it sends an alert so the platform administrator can fire the trigger manually. This could be automated too, but keeping a human in the loop for the biggest transaction the platform will ever make seems prudent.

### Event Listeners

The backend also listens for on-chain events and responds to them.

When an NFTMinted event fires, the backend uploads the initial metadata JSON to IRYS. The small upload cost is covered by deducting from the accumulated loyalty fee pool — so the platform itself never pays out of pocket for metadata storage.

When a TransferSingle event fires, the backend uploads updated metadata to IRYS with the new owner address. As with minting, the tiny IRYS upload cost is covered from the loyalty fee pool.

When a RedemptionRequested event fires, the backend records the request and starts a 48-hour timer. When the time is up, it can notify the user that their GOOGLon is ready to claim.

### Price Oracle

At mint time, the backend needs to know the current GOOGL price to record in the NFT metadata. Since our Google purchase happens on Uniswap, we pull the price directly from the Uniswap V4 GOOGLon/USDC pool — the same pool we will use for the one-time swap. This gives us the exact on-chain market price at the moment of mint, with no external oracle dependency.

---

## 11. External Integrations

### On-Chain (Ethereum Mainnet)

The platform integrates with four external smart contracts, all of which are established, audited, and widely used.

USDC at 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 — Circle's regulated stablecoin. This is the mint currency and the asset deposited into Aave.

GOOGLon at 0xbA47214eDd2bb43099611b208f75E4b42FDcfEDc — Ondo Finance's tokenized Alphabet Class A stock. This is a total return tracker, meaning it reflects both the stock price and reinvested dividends. It is fully backed by real GOOGL shares held at a regulated US custodian. We verified that it trades on Uniswap with sufficient liquidity for retail-sized purchases, though a bulk buy of tens of thousands of dollars may need to be split across multiple trades or executed as a time-weighted average price swap.

Aave v3 Pool at 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 — the lending protocol where the 20% DeFi pool earns yield. USDC supply APY is currently around 3.19%, though this varies with utilization. Withdrawals are instant and permissionless.

Uniswap V4 Pool Manager at 0x000000000004444c5dc75cB358380D2e3dE08A90 — the decentralized exchange used for the one-time USDC to GOOGLon swap. We tested this route successfully: a transaction on June 6, 2026 swapped ETH to USDC to GOOGLon through Uniswap V3 and V4 pools with a 0.3% fee tier.

WETH at 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 — Wrapped Ether, used for routing if needed during the Uniswap swap.

### On-Chain Services

IRYS provides permanent NFT metadata storage on Arweave. The SDK is straightforward: install the npm packages, fund an account with Ethereum, and call upload. Mutable references are a built-in feature.

Price data for the GOOGLon value comes directly from the Uniswap V4 pool — the same pool used for the one-time Google purchase. No external oracle is needed.

Alchemy provides the Ethereum RPC endpoint for the backend bots and event listeners.

---

## 12. Risk Analysis

### Technical Risks

GOOGLon liquidity on Uniswap is currently thin. A one-time purchase of tens of thousands of dollars worth of GOOGLon in a single swap could move the price significantly. Mitigation: split the purchase into multiple smaller trades over several hours, use a time-weighted average price algorithm, or route through multiple decentralized exchanges if GOOGLon is listed on others.

If Aave's USDC supply APY drops below 2%, the DeFi yield alone cannot cover the promised interest. Currently there is a healthy buffer at 3.19%, but rates fluctuate. Mitigation: the shortfall is covered by secondary market royalties. If both DeFi yield and royalties are insufficient, interest payments slow down. The platform could also reduce the rate through governance if necessary.

Smart contract bugs are the existential risk of any DeFi project. Mitigation: use of OpenZeppelin's battle-tested contract libraries as well as other security audits we already have. The upgradeable proxy pattern also allows bug fixes without migrating user funds, though upgradeability itself introduces governance risk.

The 48-hour redemption delay means the GOOGLon price could change between when a user requests redemption and when they receive their tokens. Mitigation: users are locking in a quantity of GOOGLon, not a USD value, so this is fundamentally a market risk they accept. The delay is clearly communicated upfront.

### Business Risks

The mint might not sell out. If only a fraction of the 10,000 NFTs find buyers, the treasury is smaller and the economics are tighter. Mitigation: the early stop and burn mechanism allows the platform to close the mint gracefully. The trigger logic works the same regardless of how many NFTs were sold.

Low secondary trading volume means royalties accumulate slowly, which delays the Google purchase trigger. Mitigation: there is no time limit. The system simply waits. Users know this going in. The 2% interest continues to accrue in the meantime, funded by whatever DeFi yield is available.

GOOGL stock could drop significantly. Since the NFT represents a fixed quantity of GOOGLon rather than a fixed USD value, the value of each NFT would decline accordingly. Mitigation: this is the nature of equity exposure. Users are buying a stock certificate, not a stablecoin. The 2% interest provides some cushion, but there is no principal protection.

### Economic Sustainability

In a best-case scenario — all 10,000 NFTs sell at above the minimum price, secondary trading is active, Aave yields stay above 3%, and GOOGL appreciates — the platform generates healthy revenue from the 10% royalties and 5% redemption fees, while users enjoy stock appreciation plus weekly interest. The treasury holds real, verifiable assets backing every NFT.

In a worst-case scenario — few NFTs sell, trading is sparse, Aave yields collapse, and GOOGL drops — the platform still functions. It just takes longer. The trigger eventually fires when enough royalties accumulate. Users still get their proportional shares. Interest payments may be thin but are never zero as long as Aave produces any yield at all.

The system is designed to be patient. It does not depend on timing, market conditions, or external parties meeting deadlines. Every mechanism waits for its condition to be met, however long that takes.

---

## 13. Key Contract Addresses

These are the Ethereum mainnet addresses the platform interacts with. Our own contracts will be deployed to new addresses during development.

USDC: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48

GOOGLon (Ondo Finance): 0xbA47214eDd2bb43099611b208f75E4b42FDcfEDc

Aave v3 Pool: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2

Uniswap V4 Pool Manager: 0x000000000004444c5dc75cB358380D2e3dE08A90

WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

We verified GOOGLon tradability on June 6, 2026 with a test purchase routed through Uniswap V3 and V4. Transaction hash: 0x68cc726c134c058c2aef626083460a12d62ca4f3e56fc146a449c25767c6dfe5.

---

## 14. Development Roadmap

Phase 1 — Scaffold: Set up the Hardhat project with all dependencies (OpenZeppelin contracts, Aave interfaces, Uniswap V4 periphery, IRYS SDK). Configure for Ethereum mainnet with mainnet forking for tests.

Phase 2 — Core Contracts: Write all six Solidity contracts as specified in Section 5. This is the bulk of the development work.

Phase 3 — Tests: Write comprehensive unit tests for each contract function, plus integration tests on a Hardhat mainnet fork that simulates the full lifecycle — minting, DeFi sweeps, secondary trades, trigger firing, Google purchase, interest claims, and redemptions.

Phase 4 — Backend: Build the Node.js services: the three keeper bots, the event listeners for IRYS metadata updates and interest settlement, and the price oracle integration.

Phase 5 — Frontend: Build the Next.js dApp with wallet connection, a mint page with variable price input, a dashboard showing owned NFTs with live share values and accrued interest, and redemption flow UI.

Phase 6 — Audit: Engage a professional smart contract auditing firm. Fix any findings. Consider a bug bounty program on Immunefi or similar.

Phase 7 — Deploy: Deploy all contracts to Ethereum mainnet. Verify on Etherscan. Configure initial parameters. Transfer ownership to the platform wallet. Open minting to the public.

---

This document describes the complete Google Stock NFT system as of June 8, 2026. For ongoing progress tracking and day-to-day decisions, see the companion file PROGRESS.md.
