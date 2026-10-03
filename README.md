# Noise Generator

Generatore di noise colorato che gira interamente nel browser: nessun backend, nessuna API, nessuna risorsa remota a runtime.

- **6 colori di noise**: white, pink, brown, blue, violet, grey, con crossfade tra un tipo e l'altro.
- **6 manopole**: Volume, Low-cut, High-cut, Stereo, Onda (velocità della modulazione) e Profondità.
- **Sfondo reattivo**: il colore segue il tipo di noise e si scurisce quando si tagliano gli acuti. Il bagliore cresce con il volume, si allarga con lo stereo e "respira" insieme alla modulazione.
- **Preset**: sei predefiniti più quelli personali, salvati nel `localStorage` del browser.
- **CSV**: esportazione e importazione della configurazione.
- **WAV**: esportazione da 1 secondo a 10 minuti, renderizzata offline con la stessa catena audio dell'ascolto.

## Requisiti

- Node.js `^18.18`, `^20.9` o `>=21.1`, come richiesto da ESLint (verificato con 18.19.1 e 26.10.0)
  - Con Node 18, `npm install` mostra avvisi `EBADENGINE` per due dipendenze indirette di typescript-eslint (`brace-expansion`, `eslint-visitor-keys`): sono solo avvisi, lint, test e build funzionano.
- Un browser recente con Web Audio API: Chrome, Edge, Firefox o Safari

## Comandi

| Comando | Descrizione |
|---------|-------------|
| `npm install` | Installa le dipendenze |
| `npm run dev` | Server di sviluppo su `http://localhost:5173` |
| `npm run build` | Type check e build di produzione in `dist/` |
| `npm run preview` | Serve localmente la build di produzione |
| `npm run lint` | ESLint |
| `npm run typecheck` | Type check TypeScript |
| `npm test` | Test unitari e di integrazione (Vitest + jsdom) |
| `npm run test:watch` | Test in modalità watch |

La cartella `dist/` è un sito statico: si può servire con qualunque web server locale. Non va aperta con `file://`, perché i moduli ES richiedono HTTP.

## Controlli

| Azione | Mouse | Tastiera (manopola con focus) |
|--------|-------|-------------------------------|
| Regola | Trascina in verticale, rotella | `↑` `→` / `↓` `←` |
| Passo ampio | — | `PagSu` / `PagGiù` |
| Minimo / massimo | — | `Home` / `Fine` |
| Regolazione fine | Tieni premuto `Maiusc` | Tieni premuto `Maiusc` |
| Ripristina il default | Doppio clic | `Canc` o `Backspace` |

`Spazio` avvia e ferma la riproduzione quando il focus non è su un campo o un controllo.

Se il sistema interrompe l'audio (per esempio una chiamata sul telefono), la riproduzione risulta fermata: basta premere di nuovo **Avvia** per riprendere, con una breve dissolvenza in entrata.

Le manopole implementano il pattern ARIA *slider*, con valore leggibile dagli screen reader (es. "12,0 kHz"). Con `prefers-reduced-motion` le animazioni decorative vengono disattivate.

## Preset e colori

Un preset è una configurazione completa: contiene il **colore del noise** e i valori di **tutte e 6 le manopole**. Applicarlo cambia quindi anche il colore e lo sfondo.

| Preset | Colore | Volume | Low-cut | High-cut | Stereo | Onda | Profondità |
|--------|--------|--------|---------|----------|--------|------|------------|
| Pioggia | pink | 55 % | 120 Hz | 9 kHz | 120 % | 0,15 Hz | 20 % |
| Oceano | brown | 65 % | 30 Hz | 3,5 kHz | 130 % | 0,08 Hz | 65 % |
| Focus | grey | 45 % | 60 Hz | 12 kHz | 100 % | 0,10 Hz | 0 % |
| Sonno profondo | brown | 50 % | 20 Hz | 1,2 kHz | 80 % | 0,05 Hz | 15 % |
| Ventola | pink | 60 % | 80 Hz | 2,5 kHz | 60 % | 1,20 Hz | 8 % |
| Cascata | white | 55 % | 200 Hz | 14 kHz | 140 % | 0,30 Hz | 10 % |

Il legame va in una sola direzione:

- **Il preset imposta il colore**: il colore del noise viene scelto insieme alle manopole.
- **Cambiare colore non modifica il preset**: se dopo averlo applicato cambi colore o giri una manopola, il preset salvato resta invariato. Nel pannello compare il badge **"modificato"**, e riapplicando il preset si torna ai suoi valori.
- **I preset personali salvano il colore attivo**: "Salva" memorizza il colore e le manopole del momento. Lo stesso vale per l'export CSV (riga `type`).
- **Rinominare un preset** non cambia la configurazione. **Eliminare il preset attivo** lascia invariato il suono corrente, che diventa una "Configurazione libera".
- **Nomi**: al massimo 40 caratteri, gli spazi multipli vengono ridotti a uno e non possono coincidere, senza distinzione tra maiuscole e minuscole, con un altro preset, predefiniti compresi.

Lo sfondo dipende solo dalla configurazione corrente, non da quale preset è stato applicato: la stessa configurazione, ottenuta con un preset o a mano, produce lo stesso sfondo.

| Elemento del suono | Effetto sullo sfondo |
|--------------------|----------------------|
| Colore del noise | Tinta dello sfondo, del bagliore e degli accenti dell'interfaccia |
| High-cut | Più basso = sfondo e bagliore più scuri e caldi |
| Low-cut | Più alto = bagliore meno saturo |
| Volume | Intensità del bagliore (attenuata quando la riproduzione è ferma) |
| Stereo | Ampiezza orizzontale del bagliore |
| Onda e Profondità | Il bagliore "respira" con la stessa velocità e intensità della modulazione, solo durante la riproduzione |

Le transizioni tra un colore e l'altro sono graduali: circa 2 secondi per completarsi quasi del tutto.

## Formato CSV

```csv
parameter,value,unit
format_version,1,
type,pink,
volume,60,%
low_cut,20,Hz
high_cut,20000,Hz
stereo_width,100,%
mod_rate,0.2,Hz
mod_depth,0,%
```

| Parametro | Intervallo | Unità |
|-----------|------------|-------|
| `type` | `white`, `pink`, `brown`, `blue`, `violet`, `grey` | — |
| `volume` | 0 – 100 | % |
| `low_cut` | 20 – 1000 | Hz |
| `high_cut` | 1000 – 20000 | Hz |
| `stereo_width` | 0 – 150 | % |
| `mod_rate` | 0.05 – 2 | Hz |
| `mod_depth` | 0 – 100 | % |

Regole di importazione:

- **Accettati senza problemi**: righe in qualsiasi ordine, righe vuote, spazi, fine riga CRLF, BOM e maiuscole.
- **Importati con un avviso**:
  - i valori fuori intervallo vengono riportati al limite;
  - i parametri mancanti prendono il valore predefinito;
  - i parametri sconosciuti vengono ignorati;
  - i parametri ripetuti prendono l'ultimo valore.
- **Rifiutati, con il numero di riga**: tipo di noise sconosciuto, valori non numerici (sono ammessi solo decimali con il punto, es. `0.2`; non `1e2` o `0x1F`), righe senza la colonna `value`, intestazione assente, versione di formato non supportata.
- **Rifiutati**: file vuoto, binario o più grande di 64 KB.

La colonna `unit` è informativa e viene ignorata in lettura.

## Architettura

```
src/
├── domain/      Tipi, specifiche dei parametri, spettro teorico (logica pura)
├── audio/       Generazione dei buffer, catena Web Audio, engine live, render offline
├── io/          Encoder WAV, serializzazione/parsing CSV, download
├── presets/     Preset predefiniti, validazione nomi, persistenza localStorage
├── state/       Reducer della configurazione
├── theme/       Mappatura suono → colori e interpolazione
├── hooks/       Collegamento tra React e audio, tema, preset
├── components/  UI (manopola, selettore, pannelli)
├── styles/      SCSS (layer Tailwind) e token di design
└── test/        Setup di Vitest e helper condivisi dai test
```

- **Buffer di noise**: ogni tipo è un buffer stereo di 12 secondi con canali indipendenti, riprodotto in loop senza click grazie a un crossfade interno. Viene generato solo quando serve e poi tenuto in cache.
- **Catena audio**: `NoiseGraph` (high-pass → low-pass → matrice mid/side → modulazione → master) è condivisa tra riproduzione live (`NoiseEngine`) ed esportazione (`renderNoise`, con `OfflineAudioContext`), quindi il WAV suona come ciò che si ascolta.
- **Sfondo**: `useSceneTheme` interpola i colori con `requestAnimationFrame` e scrive CSS custom properties, senza re-render React. I colori vengono scritti sulla radice solo mentre cambiano, perché ogni scrittura lì ricalcola gli stili di tutta la pagina. Il valore del "respiro", aggiornato a ogni frame, è scritto solo sull'elemento di sfondo. Il ciclo si ferma appena i colori sono arrivati a destinazione e non c'è modulazione.

## Limiti noti

- L'esportazione di 10 minuti richiede oltre 300 MB di memoria temporanea (circa 212 MB per il rendering e 106 MB per il file WAV, più l'eventuale copia fatta dal browser per il download) e produce un file di circa 101 MB.
- I preset personali restano nel browser e nel profilo in cui sono stati creati. Per trasferirli si usa l'export/import CSV. Le schede aperte nello stesso profilo li condividono: un preset salvato in una scheda compare subito nelle altre.
