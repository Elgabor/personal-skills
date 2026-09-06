# Personal Skills

Reusable skills and command protection maintained by Lorenzo Borgato.
This public repository contains selected portable packages, not personal memory
or a mirror of every locally installed skill.

| Package | Purpose | Origin | License |
| --- | --- | --- | --- |
| [npm-package-guard](npm-package-guard/) | Audit direct npm dependencies and optionally guard package commands | Lorenzo Borgato | MIT |
| [command-guard](command-guard/) | Catastrophic shell denylist with Codex/Claude wiring and Pi adapter | David Ondrej, with local adaptations | MIT; original notice retained |

See each package for provenance, license notices and supported integrations.
Each package documents its installation and limits. Cloning this repository does
not install or activate hooks or skills. Hook activation and skill invocation
are separate settings.

## Publication boundary

Only paths in [public-files.json](public-files.json) are eligible for this
repository. Run `python3 scripts/check-publication.py` before staging or pushing.
The check rejects unlisted Git-visible files and common private paths/content;
it is a precaution, not proof that all sensitive information has been detected.
Review the actual diff and license notices before publication. Never use global
staging to include unrelated material.

Personal notes, chats, goals, runtime configurations, credentials, installation
inventories and third-party assets with unverified redistribution rights belong
outside this repository. Do not rely on .gitignore to hide already tracked files.

## License

Original contributions: [MIT](LICENSE). Third-party packages retain their own
copyright notices and license files. See each package's provenance before reuse.

## Installation choices

Public availability does not install or activate any package. Users choose
which packages to install and review their documented permissions and limits.
Maintainer-specific installation decisions and inventories are kept locally
and are not part of the public repository.

.gitignore defaults to excluding files not explicitly selected for publication.
When adding a public file, review it and update both public-files.json and the
exact exception in .gitignore. Already tracked files remain tracked regardless
of ignore rules; the publication check must still pass before staging or push.
