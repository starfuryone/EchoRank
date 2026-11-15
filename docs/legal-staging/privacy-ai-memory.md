# STAGED, NOT PUBLISHED: Privacy Policy paragraph on AI memory

Status: draft for owner and legal review (2026-11-15). Nothing here is served.
The live policy is `src/app/[locale]/legal/_content/privacy.tsx`. Publishing
this means adding it there (and to the French text) as a reviewed change, with
whatever version or date bump the policy uses. Do not publish it from this file.

Where it would sit: with the processing purposes, after the paragraph on AI
features (Marketing Studio, AI answers).

Facts it relies on, for the reviewer to check against the build:
- What is stored: business facts extracted by Claude Haiku (Anthropic, our existing
  AI processor) from Marketing Studio briefs and from MCP `remember` calls.
- Where: our own server, in a separate PostgreSQL database (`echorank_memory`),
  with embeddings computed on the same server (no third-party embedding service).
- What is filtered out: emails, phone numbers, card numbers and URL query
  strings are removed before anything is stored or sent for extraction, and any
  extracted fact still carrying one is dropped. The model is told not to keep
  people's names, credentials, payment, health or legal matters.
- Control: per-workspace on/off switch (on by default for paid plans), a list
  with per-item delete, and "Delete all memories" at Settings → AI memory.
- Deletion: a workspace deletion request (Settings → Account → Your data)
  removes all memories, their history and the on/off setting, before the
  workspace itself is deleted.
- Backups: the nightly backup-all-dbs.sh dumps every database, so this one too
  (root to confirm). The dumps are NOT encrypted (docs/agents/DATA.md DP2b), and
  a deleted memory stays in them until they rotate out (7 days local, plus the
  off-box copy's retention). State the real retention before publishing.
- Lawful basis to be confirmed by the reviewer (legitimate interests / contract).

## English

**AI memory.** On paid plans that include Marketing Studio or the MCP server,
Echorank can remember facts about your business that you share with it, such as
your brand, competitors, target markets, goals, tone of voice and decisions, so
that you do not have to repeat them. These facts are extracted automatically
by our AI provider from what you type into Marketing Studio or send with the MCP
`remember` tool, and are stored on our own servers in a database kept separate
from the rest of your account. Before anything is stored or sent for
extraction, we remove email addresses, phone numbers and card numbers, and we
instruct the AI not to keep information about individual people, credentials,
payment details or sensitive matters. AI memory can be switched off for your
workspace at any time in Settings → AI memory, where you can also see every
stored fact and delete any of them, or all of them. When a workspace is
deleted, its memories are deleted with it. [Backup retention sentence, once
confirmed.]

## Français

**Mémoire IA.** Sur les forfaits payants qui comprennent le Marketing Studio ou
le serveur MCP, Echorank peut retenir des faits sur votre entreprise que vous lui
communiquez, comme votre marque, vos concurrents, vos marchés cibles, vos
objectifs, votre ton et vos décisions, afin que vous n'ayez pas à les répéter.
Ces faits sont extraits automatiquement par notre fournisseur d'IA à partir de ce
que vous saisissez dans le Marketing Studio ou envoyez avec l'outil MCP
`remember`, et sont conservés sur nos propres serveurs, dans une base de données
distincte du reste de votre compte. Avant tout stockage ou envoi pour
extraction, nous retirons les adresses e-mail, les numéros de téléphone et les
numéros de carte, et nous demandons à l'IA de ne conserver aucune information
sur des personnes, aucun identifiant de connexion, aucune donnée de paiement ni
aucune information sensible. La mémoire IA peut être désactivée à tout moment
pour votre espace de travail dans Paramètres → Mémoire IA, où vous pouvez aussi
consulter chaque fait enregistré et en supprimer un, ou tous. Lorsqu'un espace
de travail est supprimé, sa mémoire l'est aussi. [Phrase sur la conservation des
sauvegardes, une fois confirmée.]
