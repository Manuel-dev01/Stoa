# Stoa demo video script

A 90-second narrated walkthrough that hits every load-bearing claim in the pitch. Built for the Agora Agents Hackathon submission form. Total budget: 90 seconds, hard cap 120s.

## Before you record

1. **Open four browser tabs in this order, left to right.** Switching tabs is the entire "scene change" mechanism; no zooming or animations needed.
   - Tab 1: `https://stoa-agents.vercel.app/` (the leaderboard)
   - Tab 2: `https://stoa-agents.vercel.app/agents/0x797badd2de144db6311a1f0f79a2d3e544021a003c7e96544cbc5441901e6be7` (the canonical agent's detail page)
   - Tab 3: `https://testnet.arcscan.app/tx/0x081cac832047930ac6918a3c0715c8a4cc2082942662a9ea345b85da5db8bf58` (a real `TracePublished` tx on Arc)
   - Tab 4: `https://devnet.irys.xyz/FipMDzHKc8Uz9GVtWrHNRKf1yN3KwiyBVFHPP3tWEZdo` (the trace body on Irys)

2. **Have one terminal visible** at 16pt+ font, in `apps/agent/`, pre-typed with: `uv run python -m stoa_agent.cli publish-trace --market-id 0x<active condition_id>`. Do not run it yet.

3. **Have Polymarket open** in tab 5 to the same market the trace covers, so the "Route this trade" beat lines up visually.

4. **Close everything else.** No notifications, no IDE, no extra terminals.

5. **Audio setup.** Recommended chain: ElevenLabs voice clone (or a free voice like ElevenLabs "Adam" or "Antoni") for narration; Audacity or Descript for cleanup. If you prefer your own voice, use a USB mic and record in a closet (clothes absorb echo).

---

## Shot-by-shot script

Times are cumulative. Each row corresponds to one continuous take you can stitch together in Descript or DaVinci Resolve.

| Time | What's on screen | Voiceover (read at normal pace, ~150 wpm) | Human action |
|------|------------------|-------------------------------------------|--------------|
| 0:00–0:08 | Black title card with the line *"Reasoning is the product."* in Newsreader serif on a near-black background. | "Trading agents have a model. They don't have a product. Tauric Research's Trading-R1 paper said the value is the reasoning trace, not the trade. Stoa gives the trace a home." | None. Hold the title card. |
| 0:08–0:18 | Tab 1: the leaderboard. Trace stream visible, stat pills at top showing trace count, agent count, "anchored on Arc". | "This is Stoa. Twenty-five trading agents, each with its own analytical persona. Three hundred plus reasoning traces, every one of them anchored on Arc with a sub-second transaction." | Scroll slowly down the trace stream so 3 to 4 cards pass by. Stop scrolling at a recent SELL trace. |
| 0:18–0:30 | Same tab, click on a trace card to expand the dialog. Show bull/bear/synthesis reasoning. | "Each trace is a real LLM inference. Bull case. Bear case. Synthesis. Calibrated rating from negative three to positive three. Confidence in basis points." | Open the trace dialog. Expand the synthesis section. Hover over the rating and confidence pills so they're visually highlighted. |
| 0:30–0:42 | Tab 3: the Arc explorer page for the tx. `TracePublished` event visible, topics highlighted: `agentId`, `marketId`, `traceHash`. | "Every trace is a single `TracePublished` event on Arc testnet. Bytes thirty-two agent identity. Bytes thirty-two market identifier. Keccak hash of the trace body. Irys receipt. Costs roughly one cent in USDC gas. Settles in under one second." | Switch to tab 3. Use cursor to point at each of: agentId topic, marketId topic, traceHash in event data. |
| 0:42–0:55 | Tab 4: the raw Irys JSON. | "Click the Irys receipt and the full reasoning body is right there, content-addressed and permanently retained. The hash on chain and the bytes on Irys are inseparable. Anyone can verify." | Switch to tab 4. Highlight the `reasoning` section of the JSON with cursor. |
| 0:55–1:08 | Tab 2: agent detail page. Show stats, Treasury actions panel, recent traces. | "Each agent has its own page with a treasury anyone can fund. Deposits sit as USDC on Arc, or earn yield in USYC when the vault is wired. Redemption returns USDC plus accrued yield in one transaction." | Switch to tab 2. Scroll to Treasury actions, type "1" in the amount field, hover over Deposit so the button highlights, but don't click. |
| 1:08–1:22 | Tab 2 still. Open a trace dialog, scroll to the bottom where "Preview BUY through agent" / "Route this trade" lives. | "Now the loop closes. The user clicks Route this trade. The order is signed with the agent's own bytes thirty-two in Polymarket V2's builder slot. Builder fees, up to half a percent taker and a quarter percent maker, accrue in pUSD to the agent's wallet. The reasoning author gets paid every time someone trades on their call." | Open the trace dialog. Scroll to the Route section. Click "Preview BUY through agent" so the signed order JSON appears. Highlight the `builder` field in the response with cursor. |
| 1:22–1:30 | Black close card: *"Stoa. The agora has agents now."* with `stoa-agents.vercel.app` underneath. | "Stoa is live on Arc testnet today. Twenty-five agents publishing. Polymarket routing production-ready. The substrate is here. Anyone can plug in." | Hold the close card. Fade audio. |

---

## Voice production checklist

After the recording is stitched in your editor of choice:

1. **Normalize loudness** to roughly -16 LUFS for web. Descript and Audacity both have this built in.
2. **Trim silence** between scene cuts to no more than 250ms. The pacing should feel deliberate, not slow.
3. **Add a subtle low-pass to the narration** if the voice sounds harsh; cut everything above 12kHz.
4. **No music.** Music in a 90-second demo competes with the words. Silence between beats is fine.
5. **One soft "ding" at 0:42 when the explorer page appears.** A 200ms confirmation tone. This is the only sound effect.
6. **Subtitles burned in.** Most judges will watch muted. Use Descript's auto-captioner or YouTube's auto-CC then export the SRT.

## AI tools you can use

These are listed in order of how much they save vs. how much friction they add.

| Tool | What for | Why |
|------|----------|-----|
| **ElevenLabs** ([elevenlabs.io](https://elevenlabs.io)) | Voiceover. Either pick a preset voice or clone your own from a 60-second sample. | Cleanest narration without a studio. Free tier covers a 90-second demo. |
| **Descript** ([descript.com](https://descript.com)) | One-stop editing: stitch your screen recordings, paste the ElevenLabs audio on top, type captions, export. | The "edit by editing the transcript" model removes the worst part of timeline editing. |
| **OBS Studio** ([obsproject.com](https://obsproject.com)) | Screen recording. Free. | Records each tab cleanly at 60fps. |
| **Loom** ([loom.com](https://loom.com)) | Backup recorder if you also want a webcam corner. | Easier than OBS but a touch lower fidelity. |
| **CapCut** ([capcut.com](https://capcut.com)) | If you prefer a TikTok-style editor over Descript. Free desktop app. | Best when you want canned animations like "highlight the cursor". |
| **Frame.io** ([frame.io](https://frame.io)) | If anyone is reviewing the cut before submission. | Time-coded comments are the right primitive. |
| **HandBrake** ([handbrake.fr](https://handbrake.fr)) | Final encode to MP4 H.264, target ~5 Mbps for a clean 1080p file under 75MB. | Submission form has size limits. |

## A workflow that fits in a 90-minute block

If you are recording in one session today, this is the order of operations.

1. **0–10 min.** Open the four tabs, position windows, confirm the trace and the Polymarket market are still active. Pre-resolve any login modals.
2. **10–25 min.** Record voiceover in ElevenLabs first. Paste the script directly. Generate three takes per paragraph and pick the cleanest. Export each block as a separate WAV so Descript can sync.
3. **25–55 min.** Record screen captures with OBS. Use the time table above as cue card. Do not try to lip-sync; you will overlay audio after. Just hit each beat for the right duration.
4. **55–75 min.** Stitch in Descript. Drop voice over screen, trim, add captions.
5. **75–85 min.** Export. Encode in HandBrake. Verify the file plays on phone, on Chrome, on Safari.
6. **85–90 min.** Upload to YouTube as unlisted (or Vimeo, or Google Drive), copy the link, paste it into the submission form.

If you have to choose one quality compromise, choose video over audio. Judges will forgive a slightly blurry capture; they will not forgive narration they can't understand.

## Pitfalls to avoid

- **Don't broadcast a real Polymarket order live.** The cross-chain mismatch will reject it and the demo will end on a 500 error. Use the dry-run preview so the signed order JSON appears cleanly.
- **Don't open the trace dialog before you have a recent trace.** The multi-agent daemon publishes a fresh trace every few minutes; double-check the leaderboard's "Latest" column right before recording.
- **Don't read the address slugs aloud.** Say "bytes thirty-two agent identity" not "zero x seven nine seven B A D D".
- **Don't use percent signs in voiceover.** Say "half a percent" not "0.5 percent".
- **Don't show the terminal full of warnings.** Pre-clear it, and run the publish from a fresh shell.

## A 60-second variant if you need it shorter

Cut beats 4 (Irys body, 0:42–0:55) and 6 (Treasury, 0:55–1:08). Keep leaderboard, trace expansion, on-chain receipt, and Polymarket routing. End on the same close card. The demo still proves: reasoning is published, anchored on chain, and monetized via Polymarket builder attribution.
