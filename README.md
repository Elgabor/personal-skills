# Personal Skills

Reusable skills and hooks maintained by Lorenzo Borgato.

## Organization

- **created-by-me/** — original packages and skills.
- **by-others/** — third-party skills grouped by author, when selected for redistribution.
- **hooks/** — command protection hooks, adapters, and their maintenance instructions.

Personal distribution scripts, installation catalogues, backups and update logs
are local-only and are not published. The repository does not automatically
install or enable anything: each user chooses the packages and permissions.

## Available packages

| Package | Purpose | Origin | License |
| --- | --- | --- | --- |
| [npm-package-guard](created-by-me/npm-package-guard/) | Audit npm dependencies and optionally guard package commands | Lorenzo Borgato | MIT |
| [command-guard](hooks/command-guard/) | Catastrophic shell denylist with Codex/Claude wiring and Pi adapter | David Ondrej, with local adaptations | MIT; original notice retained |

Scripts required by a public package stay inside that package. They are part of
its functionality; they are separate from the maintainer's private distribution
and update tools. Each package documents installation, dependencies and limits.

## License

Original contributions: [MIT](LICENSE). Third-party material retains its original
copyright notices and license files. Check the package's provenance before reuse.
