<div align="center">

# Senpai Harness

**An AI senior developer ("senpai") harness that sits beside first-time vibe coders — asking before acting, deciding together, and building only what's been approved**

[![Version](https://img.shields.io/badge/version-0.3.1-blue)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/github/license/calmtiger86/senpai-harness)](LICENSE)
[![Built for Claude Code](https://img.shields.io/badge/built%20for-Claude%20Code-000000)](https://claude.com/claude-code)

[한국어](README.md) · English · [中文](README.zh.md) · [日本語](README.ja.md)

</div>

---

## Table of Contents

- [Who this is for](#who-this-is-for)
- [The harness that keeps "autopilot" in check](#the-harness-that-keeps-autopilot-in-check)
- [What it does](#what-it-does)
- [Install](#install)
- [License](#license)

Everyone was a beginner once.

Back then, there was a line we all heard from our seniors.

"Just ask when you don't know. But do I really have to explain every little thing?"

Senpai Harness asks first — about the things you probably don't know — and kindly explains what's been decided before it ever starts the work.

It plays the role of the ideal senior developer, the one that doesn't really exist in real life.

The most patient senpai for a non-developer trying vibe coding for the first time.

Senpai Harness is an AI senior-developer ("senpai") harness that asks first, explains things in plain language, decides together, builds only within "an approved scope,"

and logs every decision and failure to Obsidian (a markdown note-taking app).

## Who this is for

This was built for people who don't know any coding syntax, people opening a terminal or Claude Code for the very first time today, people who want to build an app, a chatbot, or an automation through vibe coding (describing what you want in conversation and letting AI write the code), and people who've given up on vibe coding before because keeping up with what the AI produced felt overwhelming.

If you're already comfortable with code, the "ask first, then get approval" workflow this harness insists on may feel slow.

Senpai Harness optimizes for "being able to follow along to the end," not for speed.

## The harness that keeps "autopilot" in check

Vibe coding is convenient because the AI writes the code on its own — but in practice, it often reasons its way toward whatever direction looks plausible and just runs with the decision itself.

Leave that "autopilot" running with the AI making every call on its own, and it tangles into spaghetti code you can no longer touch.

Instead of letting it reason things out and "autopilot" on its own, this is a harness that makes the AI automatically open the right kind of meeting, present the decisions you didn't know you needed to make as options you can understand, and write code only "within the scope you've approved."

> Picture a home renovation. Until the homeowner signs the estimate, the contractor can't drive in a single nail — no matter how skilled they are. Nobody can sign on the homeowner's behalf, and even a signed estimate doesn't cover a room that was never listed on it.

The AI's ability to write files stays blocked until you send an approval phrase in chat, yourself. This isn't the AI "being careful on its own" — it's a separate safety mechanism enforcing it mechanically, every time.

## What it does

### It surfaces hidden decisions before touching anything

> "Just add a login feature" sounds simple, but it drags in decisions hidden inside the wall, like wiring and plumbing: where to store the data, how to protect the password, whether login is even necessary in the first place. A good contractor doesn't pick up a hammer first — they show you the list of hidden issues and ask how you'd like to handle each one.

Senpai Harness works the same way. When you ask it to "add a feature," it doesn't start coding immediately — it turns the hidden decisions into a list and presents them as option cards (A/B/C/D). If a smaller approach would already be enough, it recommends that alternative **first**.

### Risky requests get reviewed from multiple angles at once

> Before major surgery, internal medicine, surgery, and anesthesiology doctors meet at the same time for a joint consultation, each reviewing from their own angle. The consulting doctors only give opinions — only the operating surgeon ever holds the scalpel.

A request with a risk signal — like "add a payment feature" — gets reviewed simultaneously by several roles: risk, planning, verification, and more. Every one of these reviewers is read-only, so none of them can write code directly. The scalpel still belongs to exactly one person.

### It never takes the AI's own "all done" at face value

> Even if the crew says "the work is finished," the final payment doesn't go out until the building inspector has checked the site in person.

Senpai Harness only lets completion be reported through five defined levels (from "partially done" to "verified complete"), and blocks a bare "done" claim with no evidence behind it. If you ask "is this done?", it will **honestly** tell you which parts aren't, if any aren't.

### It carries decisions and failures forward into the next session

> A company where work continues smoothly even after staff turnover has handover notes: what was decided and why, what incidents happened and how they were resolved — all written down, so the next person never has to start from zero.

Senpai Harness automatically records why each decision was made, how each error was resolved, and what was done today versus what's left, into an Obsidian vault (a memory folder). Next time, just say "continue" — it'll show you exactly where things left off.

## Install

Type these three lines into Claude Code, in order.

```text
/plugin marketplace add calmtiger86/senpai-harness
/plugin install senpai-harness@senpai-harness
/senpai-harness:init
```

Running the last line creates `vault/` (the Obsidian memory folder), `CLAUDE.md`, `AGENTS.md`, and `senpai.config.yaml` in your project. Of these, `senpai.config.yaml` is the switch that turns the harness's safety mechanism on — a project without this file runs no checks at all and behaves exactly like stock Claude Code.

If something goes wrong during install or use, run `/senpai-harness:doctor`. It explains what's wrong in language a non-developer can read.

To see what changed in the latest version, check [`CHANGELOG.md`](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 CalmTiger
