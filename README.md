# Personal Skills

Skill create e mantenute da Lorenzo Borgato per scrittura e lavoro con agenti AI.
Ogni skill è una cartella autonoma: puoi leggerla, copiarla e adattarla singolarmente.

## Skill disponibili

| Skill | A cosa serve | Note di utilizzo |
| --- | --- | --- |
| [anti-ai-slop-writing](created-by-me/anti-ai-slop-writing/SKILL.md) | Rivedere la scrittura eliminando formule ripetitive e mantenendo contenuti concreti. | Da richiamare esplicitamente; edizione pubblica portabile. |
| [effective-agent-skills](created-by-me/effective-agent-skills/SKILL.md) | Progettare, scrivere e revisionare skill e relative istruzioni. | Guida per il lavoro sui file `SKILL.md`. |
| [engineering-orchestrator](created-by-me/engineering-orchestrator/SKILL.md) | Gestire una pipeline engineering con orchestratore, worker, review e verifica finale scelti dal proprietario. | Modalità Matt predefinita oppure `native` esplicita; include definizioni di agenti Codex da installare separatamente. |
| [herdr-orchestration](created-by-me/herdr-orchestration/SKILL.md) | Orchestrare agenti di harness diverse con Herdr, pane persistenti, ruoli e worktree isolati. | Richiede Herdr; gli esempi che acquisiscono ID JSON richiedono anche `jq`. |
| [local-ai-hardware-advisor](created-by-me/local-ai-hardware-advisor/SKILL.md) | Valutare quali modelli AI locali sono compatibili con un computer e dimensionare eventuale nuovo hardware. | Usa probe locali read-only ed evidenze da model card; gli script richiedono solo Python 3. |
| [pi-workflow-router](created-by-me/pi-workflow-router/SKILL.md) | Selezionare un workflow Matt per task di coding che richiedono routing. | Non si attiva su ogni richiesta; richiede separatamente `ask-matt` e i workflow di Matt Pocock. |

## Struttura pubblica

```text
.
├── README.md
├── LICENSE
├── .gitignore
└── created-by-me/
    ├── anti-ai-slop-writing/
    ├── effective-agent-skills/
    ├── engineering-orchestrator/
    ├── herdr-orchestration/
    ├── local-ai-hardware-advisor/
    └── pi-workflow-router/
```

Ogni cartella contiene `SKILL.md` e la propria `LICENSE`, così i termini d'uso
accompagnano anche una copia singola. Le risorse restano accanto alla skill:
`references/` contiene approfondimenti, `evals/` casi di valutazione e `agents/`
metadati specifici dell'harness. Alcune skill includono risorse aggiuntive spiegate
nel proprio README. Si aggiungono sottocartelle solo quando servono.
Il formato di riferimento è [Agent Skills](https://agentskills.io/specification).

## Installazione

1. Leggi il `SKILL.md` della skill scelta e verifica eventuali dipendenze.
2. Scegli la harness e copia la cartella completa nella sua directory dedicata.
3. Conserva nome della cartella, licenza e file di supporto.
4. Verifica nella harness che la skill sia disponibile e che le condizioni di
   attivazione corrispondano a quelle desiderate.

| Harness | Directory di installazione personale |
| --- | --- |
| Codex | `~/.codex/skills/` |
| Claude Code | `~/.claude/skills/` |
| Pi | `~/.pi/agent/skills/` |

Per esempio, una copia per Codex deve avere il percorso
`~/.codex/skills/anti-ai-slop-writing/SKILL.md`.

Ogni harness mantiene una copia indipendente. Se la destinazione esiste già,
confronta prima le due versioni e conserva le personalizzazioni. I metadati di
attivazione possono essere specifici della harness: una copia dei file non
sostituisce la verifica del comportamento. Questa cartella è un archivio;
non configurarla come directory condivisa di caricamento delle skill.

`engineering-orchestrator` richiede inoltre di copiare esplicitamente i file
`codex-agents/*.toml` in `~/.codex/agents/`, come descritto nel suo
[README](created-by-me/engineering-orchestrator/README.md). La copia della sola
skill non installa quegli agenti.

## Aggiornamenti e pubblicazione

L'aggiornamento dell'archivio e quello delle installazioni sono passaggi distinti.
Per distribuire una revisione, confronta i file con ogni copia installata,
integra le modifiche preservando gli adattamenti locali e verifica la harness.
La scelta delle skill e delle destinazioni resta esplicita.

Il `.gitignore` consente solo i file pubblici già selezionati. Un nuovo file,
anche dentro una skill pubblica, resta escluso finché non viene aggiunto
all'elenco consentito dopo la revisione di contenuto e licenza.

Sono candidate alla pubblicazione solo skill generalizzabili: niente path
personali, inventari locali, contenuti di note, configurazioni di account o
regole legate a un singolo workspace. Il nome di una cartella locale non basta
a renderla pubblicabile; deve comparire file per file nell'allowlist.

Prima di preparare un commit, controlla:

```sh
git status --short --untracked-files=all
git diff -- README.md .gitignore created-by-me/
git diff --check
```

Dopo aver preparato il commit con i soli file desiderati, controlla
`git diff --cached --name-status`, `git diff --cached` e
`git diff --cached --check` prima di committare. Verifica anche autore e email
del commit, usando un indirizzo `noreply` se non vuoi pubblicare quello personale.

File, metadata dei commit, cronologia e tag sono tutti raggiungibili quando la
repository è pubblica. Il `.gitignore` non esclude file già tracciati e non
cancella la cronologia; eliminare una release non elimina automaticamente il tag.
Vedi la [documentazione Git](https://git-scm.com/docs/gitignore).

## Contenuti locali

La copia locale del maintainer può contenere inventari, skill e configurazioni
non destinati alla pubblicazione. Questi contenuti non fanno parte della
distribuzione pubblica. Le skill di altri autori restano nelle directory delle
harness. Script di distribuzione, hook e CI di aggiornamento non sono inclusi
in questa repository.

## Autori e licenza

Le skill pubblicate qui sono distribuite con [licenza MIT](LICENSE).
Conserva la licenza e i relativi avvisi nelle copie e nelle modifiche.
I crediti e le dipendenze specifiche sono documentati nelle cartelle interessate.

Il [router](created-by-me/pi-workflow-router/README.md) usa i workflow di
[Matt Pocock](https://github.com/mattpocock/skills), da installare separatamente:
questa repository non include quei workflow né ne rivendica la paternità.
La licenza di questa repository non sostituisce le licenze dei componenti di terzi.
