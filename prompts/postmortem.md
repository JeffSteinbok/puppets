Treat this issue as a postmortem for an already-merged bug fix.

1. Reconstruct the original failure from the linked pull request, issue, diff, and history.
2. Identify where the defect was introduced and whether it was a regression or latent gap.
3. Write a genuine 5-Whys causal chain that reaches the deepest actionable cause.
4. Make surgical hardening changes that prevent the broader bug class, including a
   regression test and relevant sibling-case tests.
5. Validate the repository using its documented build and test commands.
6. Open a hardening pull request that closes the postmortem issue. Include the complete
   analysis in the pull request body between these markers:

   `<!-- postmortem-writeup:start -->`

   `<!-- postmortem-writeup:end -->`

Do not merge the pull request.
