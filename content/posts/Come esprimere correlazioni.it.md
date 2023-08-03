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

In questo articolo illustro nel dettaglio un pattern semi-sconosciuto e sufficientemente complicato ma piuttosto potente per esprimere correlazioni tra diverse entità. Nel corso del tempo mi sono ritrovato più volte a vederlo consigliato per risolvere problemi all'apparenza differenti, ma che, in realtà, avevano una radice comune. Il pattern in questione è ben presentato in [questa pull request](https://github.com/microsoft/TypeScript/pull/47109), sebbene sia in realtà disponibile da diverso tempo. Dalla versione `4.6` del linguaggio è stato discretamente potenziato.

Ho un rapporto di amore e di odio con questo pattern. L'amore deriva dalla possibilità di esprimere correlazioni che altrimenti richiederebbero rischiose _type assertion_. L'odio è basato sul fatto che si è costretti a definire i tipi in gioco in un modo alquanto inusuale, mi azzarderei a dire non idiomatico, e soprattutto non semplice da comprendere.

Parliamone francamente, la struttura del pattern è piuttosto orrenda. Il buon vecchio [jcalz](https://stackoverflow.com/users/2887218/jcalz), il quale si è fatto portavoce dell'intera comunità nel richiedere il [supporto all'espressione di tali correlazioni](https://github.com/microsoft/TypeScript/issues/30581), una volta commentò dicendo: "_Do real world TS programmers know what to do with this?_". Ed è proprio jcalz a suggerire spesso su SO alcune strategie semplificate per poter utilizzare più agilmente il pattern. Ci tengo a sottolineare che jcalz è uno degli utenti più esperti del linguaggio, con una vasta conoscenza e una esperienza sconfinata ben superiore alla mia. È perciò interessante vedere come uno sviluppatore di tale calibro sia fondamentalmente scontento dello stato attuale e preferisca suggerire soluzioni in una certa misura differenti dall'unica ufficiale.

È necessario però fare più che la solita attenzione. Recentemente ho notato che una di queste soluzioni ha cessato di funzionare e ho aperto una [issue](https://github.com/microsoft/TypeScript/issues/54834) per chiedere chiarimenti e indicazioni. La risposta di Hejlsberg non lascia spazio a dubbi: la correlazione viene certamente rilevata a patto che si segua alla lettera il pattern.

Quindi, perché ho scritto questo articolo? Innanzitutto per spiegare il pattern in questione: vedremo una istanza del problema che risolve e come sfruttarlo a regola d'arte nel caso specifico. Adlilà dell'opinione che posso avere rimane un utilissimo strumento da inserire nella propria toolbox, nonché l'unico per affrontare determinate situazioni. Spiegherò poi cosa è che proprio non mi piace, cosa in particolare trovo scomodo nel suo utilizzo, e proporrò una soluzione per arginare queste difficoltà.

La mia proposta è fortemente basata sulle strategie alternative suggerite da jcalz, ma ho fatto il possibile per identificare le ragioni di alcuni malfunzionamenti delle stesse risolvendo i problemi riscontrati. Ho passato letteralmente ore a ragionare, testare e martellare, finché non ho raggiunto un compromesso che sento di poter condividere. Ho cercato di identificare quale fosse l'essenza del pattern e come poter quindi plasmare una soluzione sempre corretta ma leggermente più alla mano.

## Il problema

```ts
type NumberRecord = { kind: "n", v: number, f: (v: number) => void };
type StringRecord = { kind: "s", v: string, f: (v: string) => void };
type BooleanRecord = { kind: "b", v: boolean, f: (v: boolean) => void };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

function processRecord(record: UnionRecord) {
  record.f(record.v); // error!
 // Argument of type 'string | number | boolean' is not assignable to parameter
 // of type 'never'
}
```

Per costruzione il codice qua sopra è certamente corretto, ma TypeScript non è in grado di vedere la correlazione tra `record.v` e `record.f`. Il significato dell'errore è presto spiegato: TypeScript sa che `record.f` è una funzione, ma non è in grado di sapere quale delle tre, quindi per sicurezza richiede che il parametro vada bene in ogni caso. Esso deve quindi essere sia un `number` che una `string` che un `boolean`, ma non esistono valori che soddisfano questa richiesta. L'intersezione tra `number`, `string` e `boolean` è proprio il tipo `never` che non ha abitanti.

## Il pattern

Come primo step modifichiamo leggermente il punto di partenza del problema, cambiando la definizione del tipo `UnionRecord` nel seguente modo:

```ts
type UnionRecord = 
    | { kind: "n", v: number, f: (v: number) => void }
    | { kind: "s", v: string, f: (v: string) => void }
    | { kind: "b", v: boolean, f: (v: boolean) => void };

function processRecord(record: UnionRecord) {
    record.f(record.v);  // Error, 'string | number | boolean' not assignable to 'never'
}
```

Quella che sembra una modifica di secondaria importanza in esempi didattici come questo è invece la principale causa del mio disgusto quando è necessario applicare il pattern in casi reali, but more on that later.

Il punto chiave è la presenza di una proprietà discriminante tra le varie casistiche della union, cioè la proprietà `kind`. I valori di questa proprietà possono essere utilizzati a loro volta come chiavi di un oggetto, ed è su questa semplice osservazione che fa perno l'intero pattern. Dobbiamo infatti definire una __type map__ che fungerà da colonna portante dell'intera correlazione. Vediamo come:

```ts
type TypeMap = { n: number, s: string, b: boolean };

type RecordType<K extends keyof TypeMap> = { 
  kind: K, 
  v: TypeMap[K], 
  f: (v: TypeMap[K]) => void 
};

type UnionRecord = RecordType<'n'> | RecordType<'s'> | RecordType<'b'>;

function processRecord<K extends keyof TypeMap>(record: RecordType<K>) {
    record.f(record.v);
}
```
[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-dev.20230801#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgDRQDOBtwFAljgOY2kGkD2PANhCQ4oAXwDcAKEmhIUAEoQAxjwoATOJAA8AaSgQAHsAg41tKAGsIIHgDNY8ZGAB86LFElRLrNQR01PKAA3Ak1EFABtHQBdAK9bAgAKEIdIJyjogEp0VyCeZjUPCWlZaABVHGYeHEUVdTda1Q14LQByHFbXAB8FZSawttpOqB7G9QHW0k6pSVtCHCVgKpEwCh4lCFpaMbVdfSMTM0trO1Twl0SKPvUCHYGdZ2zMQK8rurUAOltL68+gzPEXgA9ECoAB5CySUSSIA)

La type map associa il `kind` di cui sopra con il corrispondente tipo del campo `v` che è anche il tipo del parametro della funzione `f` nella stessa entry dell'unione. Vedremo più avanti che abbiamo discreta libertà nella definizione della type map che regge l'intera correlazione; in questo caso però questa precisa definizione è l'unica sensata.

La type function `RecordType<K>` codifica perfettamente la corrispondenza tra i `kind`, i tipi e le due proprietà correlate. Essa __è definita in funzione di `TypeMap`__ ,la quale funge da upper bound per il type parameter `K` e viene utilizzata per correlare il campo `v` con il parametro della `f`. Essi hanno infatti entrambi il tipo `TypeMap[K]`.

`RecordType` non è altro che lo scheletro dell'unione `UnionRecord` definita nello snippet precedente, unione che può essere facilmente espressa come ` RecordType<'n'> | RecordType<'s'> | RecordType<'b'>`.

Notiamo infine che anche la funzione `processRecord` è stata definita in termini della type map. In particolare il tipo del parametro non è `UnionRecord` né un type parameter il cui upper bound è `UnionRecord`, bensì è un generico `RecordType<K>`. All'interno della funzione si ha che il tipo di `record.f` è `(v: TypeMap[K]) => void`, mentre il tipo di `record.v` è `TypeMap[K]`. All fine and dandy.

### Offuscamento del codice

Viene poi consigliato di unire assieme `RecordType` e `UnionRecord` per evitare la possibilità di creare record non distribuiti (e.g. `RecordType<"n" | "b">`) e per automatizzare la definizione stessa di `UnionRecord` a partire dalle entry della `TypeMap`:

```ts
type TypeMap = { n: number, s: string, b: boolean };

type UnionRecord<K extends keyof TypeMap = keyof TypeMap> = { [P in K]: {
    kind: P,
    v: TypeMap[P],
    f: (v: TypeMap[P]) => void
}}[K];

function processRecord<K extends keyof TypeMap>(record: UnionRecord<K>) {
    record.f(record.v);
}
```
[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-dev.20230801#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgDRQDOBtwFAljgOY2kGkD2PANhCQ4oAXwDcAKEmhIUAKo5mPHACUIAYx4UAJgB4A0lAgAPYBBw7aUANYQQPAGax4yVBjsPncSG4B86FhQANoAClCsUAYAugSYklCJtqw6BKFUCUkAbgQ+iChh0RlJUI4EABQ5Lr4FodEAlOgBWTzMOpKiosExUpKOhDgawMoiYBQ8GhC0tOpauobGZhZWtvZO1flgfuUUmtqpCkoqs-uGfo3xJbtzOgB0jjt7urdZ9VKiQA)