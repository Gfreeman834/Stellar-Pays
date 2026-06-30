#!/usr/bin/env bash
#
# Purge the leaked secret files from the ENTIRE git history.
#
# Context: harness/employees.json and harness/signers.json were committed in the
# root commit and pushed to origin/main, so the seeds are already public. The
# real fix is rotation (regenerate keys with `node harness/gen-args.mjs`); this
# script only removes the files from history for hygiene.
#
# !!! DESTRUCTIVE: this rewrites every commit hash and REQUIRES a force-push. !!!
# !!! Do NOT run without explicit sign-off. Coordinate with anyone who has a   !!!
# !!! clone, since they must re-clone or hard-reset afterwards.                !!!
#
# Prereqs:
#   pip install git-filter-repo        # https://github.com/newren/git-filter-repo
#
# Steps (run from the payroute-stellar repo root):
#
#   1. Back up first:
#        git clone --mirror . ../stellar-pays-backup.git
#
#   2. Remove the files from all history:
#        git filter-repo --invert-paths \
#          --path harness/employees.json \
#          --path harness/signers.json
#
#   3. filter-repo drops the 'origin' remote by design. Re-add it:
#        git remote add origin git@github.com:Gfreeman834/Stellar-Pays.git
#
#   4. Force-push the rewritten history (ASK BEFORE THIS):
#        git push origin --force --all
#        git push origin --force --tags
#
#   5. Tell every collaborator to re-clone (old clones still contain the seeds).
#
#   6. Rotate the keys regardless — history removal does NOT un-leak what was
#      already pushed:
#        cd harness && node gen-args.mjs
#
set -euo pipefail
echo "This script is documentation only. Read the comments and run the steps"
echo "manually after sign-off. Refusing to auto-run a history rewrite."
exit 1
