# Personal Skills

Skill create e mantenute da Lorenzo Borgato per scrittura e lavoro con agenti AI.
Ogni skill è una cartella autonoma: puoi leggerla, copiarla e adattarla singolarmente.

## Skill disponibili

| Skill | A cosa serve | Note di utilizzo |
| --- | --- | --- |
| [anti-ai-slop-writing](created-by-me/anti-ai-slop-writing/SKILL.md) | Rivedere la scrittura eliminando formule ripetitive e mantenendo contenuti concreti. | Da richiamare esplicitamente; edizione pubblica portabile. |
| [effective-agent-skills](created-by-me/effective-agent-skills/SKILL.md) | Progettare, scrivere e revisionare skill e relative istruzioni. | Guida per il lavoro sui file `SKILL.md`. |
| [pi-workflow-router](created-by-me/pi-workflow-router/README.md) | Selezionare un workflow adatto alla richiesta. | Richiede separatamente i workflow di Matt Pocock. |

## Struttura pubblica

```text
.
├── README.md
├── LICENSE
├── .gitignore
└── created-by-me/
    ├── anti-ai-slop-writing/
    ├── effective-agent-skills/
    └── pi-workflow-router/
```

Ogni cartella contiene `SKILL.md` e la propria `LICENSE`, così i termini d'uso
accompagnano anche una copia singola. Le risorse restano accanto alla skill:
`references/` contiene approfondimenti, `evals/` casi di valutazione e `agents/`
metadati specifici della harness. Si aggiungono sottocartelle solo quando servono.
Il formato di riferimento è [Agent Skills](https://agentskills.io/specification).

## Installazione

1. Leggi il `SKILL.md` della skill scelta e verifica eventuali dipendenze.
2. Scegli la harness e copia la cartella completa nella sua directory dedicata.
3. Conserva nome della cartella, licenza e file di supporto.
4. Verifica nella harness che la skill sia disponibile e che le condizioni di
   attivazione corrispondano a quelle desiderate.

| Harness | Directory usata da questo sistema |
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

## Aggiornamenti e pubblicazione

L'aggiornamento dell'archivio e quello delle installazioni sono passaggi distinti.
Per distribuire una revisione, confronta i file con ogni copia installata,
integra le modifiche preservando gli adattamenti locali e verifica la harness.
La scelta delle skill e delle destinazioni resta esplicita.

Il `.gitignore` consente solo i file pubblici già selezionati. Un nuovo file,
anche dentro una skill pubblica, resta escluso finché non viene aggiunto
all'elenco consentito dopo la revisione di contenuto e licenza.

Prima di preparare un commit, controlla:

```sh
git status --short --untracked-files=all
git diff -- README.md .gitignore created-by-me/
```

Dopo aver preparato il commit con i soli file desiderati, controlla
`git diff --cached --name-status` e `git diff --cached` prima di committare.
Il `.gitignore` non esclude file già tracciati e non cancella la cronologia:
vedi la [documentazione Git](https://git-scm.com/docs/gitignore).

## Contenuti locali

La copia locale può contenere skill personali escluse da Git e `catalog.json`,
il registro privato di skill, hook, provenienza e installazioni. Questi contenuti
non fanno parte della distribuzione pubblica. Le skill di altri autori restano
nelle directory delle harness. Script di distribuzione, hook e CI di aggiornamento
non sono inclusi in questa repository.

## Autori e licenza

Le skill pubblicate qui sono distribuite con [licenza MIT](LICENSE).
Conserva la licenza e i relativi avvisi nelle copie e nelle modifiche.
I crediti e le dipendenze specifiche sono documentati nelle cartelle interessate.

Il [router](created-by-me/pi-workflow-router/README.md) usa i workflow di
[Matt Pocock](https://github.com/mattpocock/skills), da installare separatamente:
questa repository non include quei workflow né ne rivendica la paternità.
La licenza di questa repository non sostituisce le licenze dei componenti di terzi.
