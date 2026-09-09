# Preview recording slot

The README marks where to embed an actual app recording.

1. Start with `npm run dev`.
2. Select MEDIUM, seed 42, Full context, Accuracy Delta reward, and Linear Thompson Sampling (α=0.5, ridge=1).
3. Select 1× or 5× and press START. Slower speed makes candidate previews easier to follow.
4. Record the circuit, AT SELECTION context, action-score decomposition and the decision's actual reward / sampled oracle gap.
5. Pause and inspect a selected action's learned coefficients. Save `docs/demo.gif` or `docs/screenshot.png` and replace the README's media comment.

Use actual execution; do not invent a solved circuit or reward history. A fixed seed determines the sequence, not wall-clock recording timing. A run can remain at a local optimum. A recording is optional and has not been fabricated for this repository.
