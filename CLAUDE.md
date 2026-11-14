@AGENTS.md

# Solo per Claude Code

## Lavoro con i sub-agent
- Al massimo **2 agenti di sviluppo in parallelo**, ognuno su un blocco di issue correlate in sequenza, in worktree separati; scegli i blocchi in modo che non tocchino gli stessi file.
- I sub-agent **non lanciano gli e2e**: scrivono/aggiornano gli spec, verificano build, unit test e tipi degli spec. L'**ultimo agente rimasto**, dopo i merge, esegue la suite completa su develop e corregge i bug.
- Se una decisione spetta al proprietario (scelte di design, servizi a pagamento, comportamento ambiguo): fermarsi e chiedere, o commentare la domanda sull'issue.
