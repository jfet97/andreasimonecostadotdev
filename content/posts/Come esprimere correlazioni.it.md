+++
author = "Andrea Simone Costa"
title = "Come esprimere correlazioni"
date = "2023-08-03"
description = "Esprimere correlazioni tra diverse entità non è mai stato così difficile"
categories = ["typescript"]
series = ["TypeScript"]
published = false
tags = [
    "correlations",
]
featuredImage = "/images/esprimere_correlazioni/copertina.png"
images = ["/images/esprimere_correlazioni/copertina.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

## Introduzione

In questo articolo illustro nel dettaglio un pattern semi-sconosciuto e sufficientemente complicato ma piuttosto potente per esprimere correlazioni tra diverse entità. Il pattern in questione è ben presentato in [questa pull request](https://github.com/microsoft/TypeScript/pull/47109), sebbene sia in realtà disponibile da diverso tempo. Dalla versione `4.6` del linguaggio è stato discretamente potenziato.

Ho un rapporto di amore e di odio con questo pattern. L'amore deriva dalla possibilità di esprimere correlazioni che altrimenti richiederebbero rischiose _type assertion_. L'odio è basato sul fatto che si è costretti a definire i tipi in gioco in un modo alquanto inusuale, mi azzarderei a dire non idiomatico, e soprattutto non semplice da comprendere.

Nel corso del tempo mi sono ritrovato più volte a vederlo consigliato da utenti esperti del linguaggio per risolvere problemi all'apparenza differenti, ma che, in realtà, avevano una radice comune. Più precisamente spesso ne vengono presentate delle versioni semplificate, all'apparenza altrettanto efficaci, le quali non mi sento però di consigliare. Ho recentemente notato che una di esse ha cessato di funzionare e ho aperto una [issue](https://github.com/microsoft/TypeScript/issues/54834) per chiedere chiarimenti e indicazioni. La risposta di Hejlsberg non lascia spazio a dubbi: la correlazione viene certamente rilevata a patto che si segua alla lettera il pattern.

Parliamone francamente però, la struttura del pattern è orrenda. Il buon vecchio [jcalz](https://stackoverflow.com/users/2887218/jcalz), il quale si è fatto portavoce dell'intera comunità nel [richiedere il supporto all'espressione di tali correlazioni](https://github.com/microsoft/TypeScript/issues/30581), una volta commentò dicendo: "_Do real world TS programmers know what to do with this?_". Ed è proprio jcalz a suggerire spesso su SO alcune strategie semplificate per poter utilizzare più agilmente il pattern. Aldilà della correttezza delle alternative, e ci tengo a sottolineare che jcalz è uno degli utenti più esperti del linguaggio, con una vasta conoscenza e una esperienza sconfinata ben superiore alla mia, è interessante vedere come uno sviluppatore di tale calibro, il quale si fa continuamente carico, senza sosta, di aiutare altri meno esperti, prendendosi quindi una responsabilità non da poco, sia fondamentalmente scontento dello stato attuale e preferisca suggerire soluzioni in una certa misura differenti dall'unica ufficiale.

Quindi, perché ho scritto questo articolo? Innanzitutto per spiegare il pattern in questione: vedremo una istanza del problema che risolve e come sfruttarlo a regola d'arte nel caso specifico. Adlilà dell'opinione che posso avere rimane un utilissimo strumento da inserire nella propria toolbox, nonché l'unico per affrontare determinate situazioni. Spiegherò poi cosa è che proprio non mi piace, cosa in particolare trovo scomodo nel suo utilizzo, e proporrò una soluzione per arginare queste difficoltà.

La mia proposta è fortemente basata sulle strategie alternative suggerite da jcalz, ma ho fatto il possibile per identificare le ragioni del malfunzionamento delle stesse e risolvere i problemi riscontrati. Ho passato letteralmente ore a ragionare, testare e martellare, finché non ho raggiunto un compromesso che sento di poter condividere. Ho cercato di identificare quale fosse l'essenza del pattern e come poter quindi plasmare una soluzione sempre corretta ma leggermente più alla mano.