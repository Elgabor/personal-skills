---
name: anti-ai-slop-writing
description: Produces specific, human-sounding prose without recurring AI vocabulary, cadence, contrast formulas, fake certainty, or fabricated detail. Use only when the author explicitly invokes anti-ai-slop-writing in the current request. For Social copy, combine it with the author's canonical strategy, virality rules, and voice.
---

# Anti-AI-Slop Writing

## Load Only What Applies

- Read `references/language-signals.md` as a warning list, not as a mechanical
  thesaurus.
- Read `references/linguistic-patterns.md` to detect recurring sentence
  templates and cadence.
- For Social copy, first read
  the project writing instructions supplied by the user, then load both canonical
  Social files it identifies.
- For non-Social prose, do not load personal Social context.

## Core Standard

Write from verified substance rather than from a style template.

- Apply this order of priority: factual fidelity and privacy; the author's actual
  thought and voice; usefulness and clarity for the reader; detector
  robustness when it matters.
- Preserve the author's actual claim, uncertainty, vocabulary, and level of
  intensity.
- Prefer concrete events, decisions, artifacts, numbers, places, and tradeoffs
  when they are real and relevant.
- Never invent anecdotes, metrics, customers, quotes, reactions, or personal
  experience.
- Do not manufacture novelty, conflict, confidence, or emotional weight.
- Use ordinary language when the underlying observation is ordinary.

## Preserve Human Source Material

When the author supplies his own draft, notes, transcript, or phrases, treat them
as the authorship spine.

- Make the smallest edit that achieves the requested result.
- Preserve distinctive wording, thought order, uncertainty, and useful
  irregularity instead of replacing everything with uniformly polished prose.
- Correct errors when the destination requires it, but do not erase idiolect
  merely because a smoother alternative exists.
- Add connective or explanatory prose only when it carries necessary meaning.
- For personal experience, use only details present in the author's material or
  independently verified. Omit or ask for a missing detail instead of creating
  a plausible placeholder.

## Human-Authored Translation Workflow

Preserve authorship provenance when the author supplies a human-written source
text for translation.

- Distinguish faithful translation from rewriting.
- Preserve paragraph and sentence order, punctuation, repetition, uncertainty,
  emphasis, examples, and distinctive phrasing unless the target language would
  become incorrect or materially unclear.
- Translate sentence by sentence. Do not replace the source with globally
  rewritten or uniformly polished prose.
- If the author requires genuinely human-authored English, do not generate the
  translation. Ask him to provide his own English draft, then limit assistance
  to identifying errors and proposing optional line-level corrections.
- Treat any AI-generated translation as AI-assisted regardless of its detector
  score. Never describe it as human-written.
- Do not optimize against a detector threshold or repeatedly rewrite text only
  to obtain a lower score. Use detector results only to diagnose excessive
  normalization, uniform cadence, or loss of the author's original wording.
- Never introduce fabricated mistakes, unusual punctuation, irrelevant details,
  hidden characters, or simulated human behavior to alter a detector result.

## Structural Variation

- Vary sentence and paragraph length because the thought requires it, not to
  satisfy a pattern.
- Avoid repeated antithesis such as “X is not Y. It is Z.”
- Do not turn a discrepancy into a two-sentence reveal such as “X claimed A.
  It had B.” For the author's publishable prose, rewrite the relationship with
  context even when both facts are verified.
- Avoid chains of clipped declarations, symmetrical sections, automatic
  three-part lists, and repeated question-answer openings.
- Connect ideas when causation, contrast, or qualification matters.
- Do not force every paragraph to end with a lesson, transition, or CTA.
- A fragment, abrupt ending, long sentence, or rhetorical contrast is allowed
  when it matches the author's voice; repetition is the failure.

## Language and Formatting

- Treat warning-list vocabulary as suspicious only when vague or ornamental.
  A technically correct term is not forbidden.
- Prefer direct, literal statements when they express the intended meaning
  precisely. Do not replace a clear term with a decorative metaphor merely to
  display style.
- Avoid mannered prose that makes the reader work harder so the writer can
  perform. Metaphors introduce connotations the writer may not have chosen and
  cannot fully control; use them only when they add necessary meaning.
- When a literal phrase is available and sufficient, use it.
- Avoid corporate encouragement, discovery theatre, fake astonishment,
  engagement bait, generic conclusions, and self-congratulatory summaries.
- Match the destination: no Markdown decoration in plain-text posts, emails,
  DMs, or messages.
- Use punctuation naturally. Do not impose artificial numeric quotas.

## Detector-Aware Pass

Detector robustness is useful as a secondary diagnostic, not as proof of
authorship or the definition of good writing.

- When the user mentions Pangram, GPTZero, another detector, AI detection, or
  asks not to be flagged, review both reader-facing tells and broader planning
  signals: overly tidy progression, exhaustive coverage, uniform cadence,
  repeated framing, generic conclusions, and language detached from the
  author's source material.
- Prefer genuine human source material and faithful editing over simulated
  messiness.
- Never add fake anecdotes, names, prices, dates, mistakes, self-corrections,
  slang, emotional punctuation, contradictions, or irrelevant details to game
  a score.
- Never use zero-width characters, homoglyphs, hidden text, or other
  character-level evasion.
- Do not promise that a rewrite will pass a detector. Detectors, thresholds,
  and models change, and both false positives and false negatives exist.
- If a detector test is explicitly requested and an authorized testing surface
  is available, record the detector, date or version when visible, input
  length, and before/after result. Treat one result as evidence about that
  exact test, not a general guarantee.
- Never improve a detector score by weakening factual fidelity, privacy,
  the author's voice, or reader quality.

## Final Pass

Before returning publishable prose:

1. Remove claims unsupported by the available evidence.
2. Preserve the author's authorship spine when source material exists.
3. Remove unnecessary planning scaffolds, repeated points, and tidy recaps.
4. Compare the cadence against the recurring structures reference.
5. Replace generic language with concrete substance when available.
6. Check that the text could plausibly have been written by the author rather
   than by any competent model.
7. For Social copy, check the canonical Social rules and strategy before
   delivery.
8. When detector robustness matters, run the detector-aware pass without
   manufacturing human markers.
9. Rewrite once if the piece still follows a visible template.

Apply the review silently unless the author asks to see it.
