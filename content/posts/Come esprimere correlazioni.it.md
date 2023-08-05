+++
author = "Andrea Simone Costa"
title = "Come esprimere correlazioni"
date = "2023-08-05"
description = "Esprimere correlazioni tra diverse entità non è mai stato così difficile"
categories = ["typescript"]
series = ["TypeScript"]
published = true
tags = [
    "correlations",
]
featuredImage = "/images/esprimere_correlazioni/copertina.png"
images = ["/images/esprimere_correlazioni/copertina.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

## Introduzione

In questo articolo illustro nel dettaglio un pattern semi-sconosciuto e sufficientemente complicato ma piuttosto potente per esprimere correlazioni tra diverse entità. Nel corso del tempo mi sono ritrovato più volte a vederlo consigliato per risolvere problemi all'apparenza differenti, ma che, in realtà, avevano una radice comune. Il pattern in questione è ben presentato in [questa pull request](https://github.com/microsoft/TypeScript/pull/47109), sebbene sia in realtà disponibile da diverso tempo. Dalla versione `4.6` del linguaggio è stato discretamente potenziato.

Ho un rapporto di amore e di odio con questo pattern. L'amore deriva dalla possibilità di esprimere correlazioni che altrimenti richiederebbero rischiose _type assertion_, esplicite o implicite. L'odio è basato sul fatto che si è costretti a definire i tipi in gioco in un modo alquanto inusuale, mi azzarderei a dire non idiomatico, e soprattutto non semplice da comprendere.

Parliamone francamente, la struttura del pattern è piuttosto orrenda. Il buon vecchio [jcalz](https://stackoverflow.com/users/2887218/jcalz), il quale si è fatto portavoce dell'intera comunità nel richiedere il [supporto all'espressione di tali correlazioni](https://github.com/microsoft/TypeScript/issues/30581), una volta commentò dicendo: "_Do real world TS programmers know what to do with this?_". Ed è proprio jcalz a suggerire spesso su SO alcune strategie semplificate per poter utilizzare più agilmente il pattern. Ci tengo a sottolineare che jcalz è uno degli utenti più esperti del linguaggio, con una vasta conoscenza e una esperienza sconfinata ben superiore alla mia. È perciò interessante vedere come uno sviluppatore di tale calibro sia fondamentalmente scontento dello stato attuale e preferisca suggerire soluzioni in una certa misura differenti dall'unica ufficiale.

È necessario però fare più che la solita attenzione. Recentemente ho notato che una di queste soluzioni ha cessato di funzionare e ho aperto una [issue](https://github.com/microsoft/TypeScript/issues/54834) per chiedere chiarimenti e indicazioni. La risposta di Hejlsberg non lascia spazio a dubbi: la correlazione viene certamente rilevata a patto che si segua alla lettera il pattern.

Quindi, perché ho scritto questo articolo? Innanzitutto per spiegare il pattern in questione: vedremo una istanza del problema che risolve e come sfruttarlo a regola d'arte nel caso specifico. Adlilà dell'opinione che posso avere rimane un utilissimo strumento da inserire nella propria toolbox, nonché l'unico per affrontare determinate situazioni. Spiegherò poi cosa proprio non mi piace e proporrò una soluzione per arginare queste difficoltà.

La mia proposta è fortemente basata sulle strategie alternative suggerite da jcalz, ma ho fatto il possibile per identificare le ragioni di alcuni malfunzionamenti delle stesse risolvendo i problemi riscontrati. Nel corso del tempo ho passato letteralmente ore a ragionare, testare e martellare, finché non ho raggiunto un compromesso che sento di poter condividere. Ho cercato di identificare quale fosse l'essenza del pattern e come poter quindi plasmare una soluzione sempre corretta ma, mi auguro, leggermente più alla mano. Leggermente.

&nbsp;

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

&nbsp;

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

La type map associa il `kind` di cui sopra con il corrispondente tipo del campo `v` che è anche il tipo del parametro della funzione `f` nella stessa entry dell'unione. Vedremo più avanti che abbiamo discreta libertà nella definizione della type map che regge l'intera correlazione; in questo caso però questa precisa definizione è quella più naturale.

La type function `RecordType<K>` codifica perfettamente la corrispondenza tra i `kind`, i tipi e le due proprietà correlate. Essa __è definita in funzione di `TypeMap`__, la quale funge da upper bound per il type parameter `K` e viene utilizzata per correlare il campo `v` con il parametro della `f`. Essi hanno infatti entrambi il tipo `TypeMap[K]`.

`RecordType` non è altro che lo scheletro dell'unione `UnionRecord` definita nello snippet precedente, unione che può essere facilmente espressa come ` RecordType<'n'> | RecordType<'s'> | RecordType<'b'>`.

Notiamo infine che anche la funzione `processRecord` è stata definita in termini della type map. In particolare il tipo del parametro non è `UnionRecord` né un type parameter il cui upper bound è `UnionRecord`, bensì è un generico `RecordType<K>`. All'interno della funzione si ha che il tipo di `record.f` è `(v: TypeMap[K]) => void`, mentre il tipo di `record.v` è `TypeMap[K]`. All fine and dandy.

### Offuscamento del codice

Viene poi consigliato di unire assieme `RecordType` e `UnionRecord` per evitare la possibilità di creare record non distribuiti (e.g. `RecordType<"n" | "b">`) e per automatizzare la definizione stessa di `UnionRecord` a partire dalle entry della `TypeMap`:

```ts
type TypeMap = { n: number, s: string, b: boolean };

type UnionRecord<K extends keyof TypeMap = keyof TypeMap> = {
    [P in K]: {
        kind: P,
        v: TypeMap[P],
        f: (v: TypeMap[P]) => void
    }
}[K];

function processRecord<K extends keyof TypeMap>(record: UnionRecord<K>) {
    record.f(record.v);
}
```
[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-dev.20230801#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgDRQDOBtwFAljgOY2kGkD2PANhCQ4oAXwDcAKEmhIUAKo5mPHACUIAYx4UAJgB4A0lAgAPYBBw7aUANYQQPAGax4yVBjsPncSG4B86FiSUCFQANoAClCsUAYAugSYwaEpNqw6BBFUySkhAG4EPogokXHZuaGOBAAUBS6+JRFxAJToAXk8zDo5YpKiYfFSko6EOBrAyiJgFDwaELS06lq6hsZmFla29k71xWB+1RSa2hkKSipLJ4Z+rUkpR8s6AHSOh8e6T3nNUqJAA)

In poche parole `RecordType` viene direttamente __distribuito__ su un sottoinsieme `K` di chiavi di `TypeMap`. Il valore di default del generico non è strettamente necessario ma è comodo nel momento in cui necessitiamo dell'intera union.

### Deoffuscamento parziale del codice

Lo snippet seguente mostra che la correlazione viene mantenuta anche nel caso in cui si indicizzi un mapped type non generico, ma definito in funzione della type map, con un index type generico appropriato:

```ts
type TypeMap = { n: number, s: string, b: boolean };

type UnionRecordType = {
    [P in keyof TypeMap]: {
        kind: P,
        v: TypeMap[P],
        f: (v: TypeMap[P]) => void
    }
};

type UnionRecord = UnionRecordType[keyof TypeMap];

function processRecord<K extends keyof TypeMap>(record: UnionRecordType[K]) {
    record.f(record.v);
}
```
[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-dev.20230801#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgDRQDOBtwFAljgOY2kGkD2PANhCQ4oAXwDcAKEmhIUAKo5mPHACUIAYx4UAJnDkZMkqCagBtAApRWUANYQQPAGax4yMAF0CR077usdAgsqYz8TADcCfUQUSw8QsJMnAgAKSNdIdziASnQAPihwnmYdUJNRSQlpWWhFZTVNbR10BSUVdS1daLN7Rxdo9w8pSSdCHA1geqgwCh4NCFpaDqaAHgBpKAgAD2AIHB1aOwdnDJiwPJSKRt0COvbrvXgzNY9cn1Mrzp0AOidLh++4WyUlEQA)

Le chiavi del mapped type `UnionRecordType` sono infatti le chiavi della type map, e l'indicizzazione `UnionRecordType[K]` avviene con un index type generico `K` il cui upper bound sono sempre le chiavi della type map.

Vi è però una differenza non indifferente rispetto ai casi precedente: con questa soluzione TypeScript non è in grado di inferire il tipo attuale di `K` durante l'invocazione di `processRecord`. Esso sarà sempre `keyof TypeMap`, come mostrato in [questo playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-dev.20230801#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgDRQDOBtwFAljgOY2kGkD2PANhCQ4oAXwDcAKEmhIUAKo5mPHACUIAYx4UAJnDkZMkqCagBtAApRWUANYQQPAGax4yMAF0CR077usdAgsqYz8TADcCfUQUSw8QsJMnAgAKSNdIdziASnQAPihwnmYdUJNRSQlpWWhFZTVNbR10BSUVdS1daLN7Rxdo9w8pSSdCHA1geqgwCh4NCFpaDqaAHgBpKAgAD2AIHB1aOwdnDJiwPJSKRt0COvbrvXgzNY9cn1Mrzp0AOidLh++4WyUgqkhmcwWSweKWwtgCBAARDgETR0gBGAAMNGSUDSBBwJHIFFyaAKWhwtAEEG+-B4bDSUAAVFBMdlRNlJAB6TlQAB6AH4gA). Entrambe le precedenti soluzioni non soffrono di questo problema.

### Estrarre le funzioni

Come pretesto per mostrare la potenza del pattern estraiamo le funzioni `f` in un'altra struttura, slegata dalla principale. Vedremo che possiamo correlare anche quest'ultima sempre attraverso la type map.

```ts
type TypeMap = { n: number, s: string, b: boolean };

type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = { 
    [P in K]: {
        kind: P,
        v: TypeMap[P]
    }
}[K];

type FuncRecord = { 
    [P in keyof TypeMap]: (x: TypeMap[P]) => void
};

function processRecord<K extends keyof TypeMap>(
    recv: ValueRecord<K>,
    recfs: FuncRecord
) {
    return recfs[recv.kind](recv.v);
}
```

[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-beta#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgDRQDOBtwFAljgOY2kGkD2PANhCQ4oAXwDcAKEmhIUAGpJ+hCACUIAYx4UAJgB4A0lAgAPYBBw7aUANYQQPAGax4yVBjsPncSG4B86FhQklChUADaAApQrFAGALoEmCFhqTasOgSRVCmpoQBuBD6IKFHxuWKSouEJUjLwUABihDga6lq6gdgVUTEink4uviiJUAAUJkWupZHxAJToAfk8zDpVdY4tGsDMPCJgFDwaELS07dr6RqbmltYD3tNgfmMUmoUKSirnuoZ+NK8aRz0Jpbb46BbJVKvYCECgiAFA8IA-IAOnSlniLzeKPycykomkkgORxOZ00FzG2HRmSgAHIcLSaO8ACwAJjENEhYXwuEWUC0OFoAggKP4PDYYxwKOAPEazBMEB0Y1ZczmOVSwOsaACAqFglF4rGtFFFjYwAAFmqKlwoKQ+brhQaJXaAPxQACMUAIAAYraI8UA)

Abbiamo che sia `ValueRecord` che `FuncRecord` sono definiti in funzione della type map. `ValueRecord` è basato sulla versione "verbosa", in modo tale che il generico `K` possa essere inferito con precisione durante l'invocazione di `processRecord`. La definizione di `FuncRecord` può invece essere resa la più semplice possibile: un mapped type non generico le cui chiavi sono le medesime type map.

All'interno di `processRecord` il `kind` di `recv` viene utilizzato per indicizzare la funzione corrispondente all'interno della struttura `FuncRecord`, e tale funzione verrà invocata sul valore `v` di `recv`. TypeScript non batte ciglio.

&nbsp;

## Il male di tutti i mali: lo switch

Torniamo alla definizione iniziale dei record, i quali ora contengono solo dati. Ipotizziamo adesso di voler invocare su ciascun valore `v` una funzione specifica, la quale avrà un proprio valore di ritorno potenzialmente diverso dalle altre. L'obiettivo è quello di definire una funzione di `match` che preso un `UnionRecord` invochi sul `v` contenuto in esso la funzione corrispondente e restituisca il valore ritornato col giusto tipo.

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => b ? 1 : 0;

function match(record: UnionRecord): ?? {
    // ??
}
```

### Tentativo 1: gli overload

Una prima soluzione del problema consiste nell'unire uno `switch` con i necessari overload della funzione `match`. Il problema di questo approccio, con o senza tipo di ritorno specificato nell'implementazione, è che siamo in presenza di type assertion implicite: nulla ci garantisce che l'implementazione rispetti le indicazioni delle signature dei vari overload. [Provare per credere](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-beta#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFRXBoDKHwcOCQbVQAKGh4+NABKYgA+KBooACooACYxUvLDBHqtfXT5NqJOrQA6UbqWoaiRnHj6pEY-PPsZzqQoAH4oAEYoRgAGYShRUQAzOBosYEjuhFtgLAALOtQspp4vwkvgWk0EqhHs9Xu8oJ9vn8AYVGDI5BlQeCoAZ0fJoS83lF4V9fv9AYxcgECk4sbxIfjYUSEaTkU5GOF3pjJrioKk6fwyKIoMKoADgHBUN0mFgqLYcExRIIgA).

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => b ? 1 : 0; 

function match(record: NumberRecord): number
function match(record: StringRecord): string
function match(record: BooleanRecord): number
function match(record: UnionRecord): string | number {
    switch(record.kind) {
        case 'n': return double(record.v)
        case 's': return trim(record.v)
        case 'b': return toNum(record.v)
    }
}
```
[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-beta#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFRXBoDKHwcOCQbVQAKGh4+NABKYgA+KBooACooACYxUvLDBHqtfXT5NqJOrQA6UbqWoaiRnHj6pEY-PPsZzqQoAH4oAEYoRgAGYShRUQAzOBosYEjuhFtgLAALOtQspp4vwkvgWk0EqhHs9Xu8oJ9vn8AYVGDI5BlQeCoAZ0fJoS83lF4V9fv9AYxcgECk4sbxIfjYUSEaTkU5GOF3pjJrioKk6fwyKIoMLsQB3KiIsmFeZuMGCkUKqBYWxaaAAchoasYAOAcFQ3Uq1RsUqc804LSFiuFytVUDVWi1UB1eu6S1ZBDNFqt1pV6qQjud+qgwA2iBNHvNluFglEgiAA)

### Tentativo 2: far casino col tipo di ritorno

La soluzione direi che si commenta da sola. Quel che è peggio è che sta in piedi solo grazie alle type assertion esplicite con tutti i rischi che ne conseguono. Le type assertion sono necessarie perché TypeScript non supporta l’analisi del control flow per rifinire un tipo parametrico: il tipo di `record` viene raffinato all'interno dei casi dello `switch`, ma altrettanto non avviene al type parameter `R`.

```ts
type NumberRecord = { kind: "n"; v: number };
type StringRecord = { kind: "s"; v: string };
type BooleanRecord = { kind: "b"; v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => (b ? 1 : 0);

type MatchRet<R extends UnionRecord> = R["kind"] extends "n"
  ? number
  : R["kind"] extends "s"
  ? string
  : R["kind"] extends "b"
  ? number
  : never;

function match<R extends UnionRecord>(record: R): MatchRet<R> {
  switch (record.kind) {
    case "n":
      return double(record.v) as MatchRet<R>;
    case "s":
      return trim(record.v) as MatchRet<R>;
    case "b":
      return toNum(record.v) as MatchRet<R>;
  }
}
```
[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-beta#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwNxQBujNiKqUAL5sAUKEhQAysFS0A5plwFiZSrQbMAzuy6NNM+UNHjoAIRw4ANhACGNRXkIly1OoyZId3KEgvW7RmLg0ACqNFQ49tiOKvDIaA7KAD5SBjQK0clQ5la2UUr4oiK4NPpQ+DhwSNYqABQ0PHxoAJTEAHxQNFAAVFAATKIlZQYIdZp6aXKtRB2aAHQjtc2DkcM4cXVIjL65dtMdtUhQAPxQAIxQjAAMyyJBEgCyNsBYABaYwAA86FAQAB7ACB0TRQMIRfKODokdAAbSYrnwTAAur8AUD8CCWEwRFATp0mqgcZcoLD4epkajAcCtNjcad9LJ0kTGKSERT-lSMcxPETTrx4oTcTwIJw0EUAGZwGhYYDgqAIZ5vb6U9EgsGRRL4Nq1VCZDToZqMJ4vd4QL7oDqkImaADuVBNUB1ermCNaVtxuKwNk00Cx9CJHqguuAcFQXQqVWsToKc04rW9UGNbw+3zaokDXp9NP9gdxwdDXUWupjcagCaTpvNaYDUEzvs8Odz+bDUGA60Q0ccsfjIIrKYt6aEIkEQA)

### Tentativo 3: gli oggetti

In [questo articolo](../lookup-types-generici-come-vivere-felici-senza-lanalisi-del-control-flow) ho presentato una soluzione alternativa all'uso del malefico costrutto `switch`, soluzione che putroppo non è applicabile a questa situazione.

```ts
type NumberRecord = { kind: "n"; v: number };
type StringRecord = { kind: "s"; v: string };
type BooleanRecord = { kind: "b"; v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => (b ? 1 : 0);

function match<
    R extends UnionRecord
>(record: R): { n: number, s: string, b: number }[R["kind"]] {
    return {
        n: double(record.v), // 'string | number | boolean' not assignable to 'number'
        s: trim(record.v), // 'string | number | boolean' not assignable to 'string'
        b: toNum(record.v) // 'string | number | boolean' not assignable to 'boolean'
    }[record.kind]; // "n" | "s" | "b" instead of something like R["kind"]
}
```

In primo luogo la costruzione dell'oggetto indicizzato avviene prima dell'indicizzazione. Tale costruzione è di fatto impossibile in quanto abbiamo solo un `record` a disposizione, il cui `v` non è di certo utilizzabile come parametro per tutte le tre funzioni. Inoltre, per poter allineare dovutamente il parametro di ritorno è necessaria una più precisa inferenza del campo `kind`, il cui tipo viene invece immediatamente espanso all'upper bound `"n" | "s" | "b"`.

Il miglior compromesso è il seguente, nel quale utilizzo un paio di barbatrucchi per risolvere tali problemi. Purtroppo però si perde il refinement su `record`: dobbiamo quindi ricorrere nuovamente a delle type assertion.

```ts
type NumberRecord = { kind: "n"; v: number };
type StringRecord = { kind: "s"; v: string };
type BooleanRecord = { kind: "b"; v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => (b ? 1 : 0);

function match<
    R extends Extract<UnionRecord, { kind: K }>,
    K extends UnionRecord["kind"] = R["kind"]
>(record: R): { n: number; s: string; b: number }[K] {
    return {
        get n() {
            return double(record.v as number);
        },
        get s() {
            return trim(record.v as string);
        },
        get b() {
            return toNum(record.v as boolean);
        },
    }[record.kind];
}
```
[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-beta#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwNxQBujNiKqUAL5sAUKEhQAysFS0A5plwFiZSrQbMAzuy6NNM+UNHjoAIRw4ANhACGNRXkIly1OoyZId3KEgvW7RmLg0ACqNFQ49tiOKvDIaA7KAD5SBjQK0clQ5la2UUr4oiK4NPpQ+DhwSNYqABQ0PHxoAJTEAHxQNFAAVFAATKIlZQYIdZp6aXKtRB2aAHQjtc2DkcM4cXVIjL65dtMdtUhQAPxQAIxQjAAMyyIiAGZwNFjAEV0INsBYABYAPCJQQFQdBQCAAD2AEDomigAFEIagbC9fmE3ol8AAaVSuDQAaSEbQxAKB+PBkOhUFRkXRAG0mDimABdFToOkMxkiNq1VCZDToZqMcgNTpNVAccZQfSydIcLYi+ICQQ03HM0jEwE84BwVBdNVA-VQOQQYCdJZkdUG-Wa7VdCpVazc3lzThQGww3gK26WwGCInew3GyVmvX+oHWnVQRY8grO10wqXyL3e30W-VGk1IYOp73hrrAdaIR0xl1unx+PJJy0p-VK6OOOY4xmiQQiIA)

### La soluzione

È necessario ricorrere nuovamente al pattern discusso in questo articolo. La soluzione non è altro che una estensione di [questo caso](#estrarre-le-funzioni), dove adesso ogni funzione ha un proprio tipo di ritorno.

```ts
type TypeMap = { n: number; s: string; b: boolean };

type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = {
    [P in K]: {
        kind: P;
        v: TypeMap[P];
    };
}[K];

const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
}

type OutputMap = {
    [K in keyof TypeMap]: ReturnType<(typeof recfs)[K]>
};

type FuncRecord = {
    [P in keyof TypeMap]: (x: TypeMap[P]) => OutputMap[P];
};

function match<K extends keyof TypeMap>(
    recv: ValueRecord<K>,
    recfs: FuncRecord
): OutputMap[K] {
    return recfs[recv.kind](recv.v);
}
```
[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-beta&ssl=34&ssc=48&pln=32&pc=1#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgNxQDOBtwFAljgOY2kGkD2PANhCQ4oAXyoAoCaEhQAakn6EIAJQgBjHhQAmAHgDSUCAA9gEHNtpQA1hBA8AZrHjJUGW-adxIrgHzosCSgoAG0ABShWKH0AXQJMIOCbVm0CMMkkqAA3Am9EFHCYjLFJURDYyQlNHEYoCg0HKwwEzPwoAAo2nBJyCgBKdH8RACooACYAGkTg+g7ZxhZ2AbR-WgA6JmZidr6pzK4Og94BIRw+gm6ySkHDqAB+KABGKAIABj6JUSkZaAB5QmAYABrgCLVChiiHkczh8KDiUDUwEIFBweV07R+0Pq6kafXKMV8n0qPygADFCDh1GpNDpQYlwpERFCvC44QR2sZcqywIVlv5-oDgQUwkUiVIHBT1MBmDwRMQkMB1AALAxGUzmSw2OzQvJ+dqJbE5eSKZTUrR6fS+PZ1BqzcmUs06CTnKACoHAVz4wLBepIlE2nG0EKGtbWFIxdohrJ9UpSCTyxVK9rYMMWAgAIhw6Ym2QIABYxmIc9jcVAAPRlohXCjxhXK5PJNNQdO0bO55vqZhIHjposB0sVuibdi1xMN1OpZukNtGhyKWjQUTF20DQeXXpAA)

Come prima `ValueRecord` è definito in modo verboso, mentre `OutputMap` e `FuncRecord` non sono altro che mapped type basati sulle chiavi della type map `TypeMap`. In `FuncRecord` il tipo di ogni parametro deve obbligatoriamente essere il tipo del campo `v` corrispondente, altrimenti non potremmo invocare tali funzioni, mentre il tipo di ritorno è arbitrariamente determinato dalle funzioni in `recfs`. All'interno di `match` il `kind` di `recv` viene nuovamente utilizzato per indicizzare la funzione corrispondente all'interno di `recfs`, e tale funzione verrà invocata sul valore `v` di `recv`. Il tipo restituito da `match` viene espresso in funzione della `OutputMap`.

&nbsp;

## L'odio e il disgusto

Soffermiamoci un momento a considerare di quanto sia peggiorata la struttura iniziale, la chiarezza e la pulizia del nostro codice per poter applicare il pattern:

```ts
// Da così...
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => b ? 1 : 0;


// ...a così
type TypeMap = { n: number; s: string; b: boolean };

type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = {
    [P in K]: {
        kind: P;
        v: TypeMap[P];
    };
}[K];

const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
}

type OutputMap = {
    [K in keyof TypeMap]: ReturnType<(typeof recfs)[K]>
};

type FuncRecord = {
    [P in keyof TypeMap]: (x: TypeMap[P]) => OutputMap[P];
};
```

Di cosa stiamo parlando? È allucinante. Allucinante. È idiomatico definire prima i componenti di una eventuale unione e poi definire l'unione tramite l'operatore `|` piuttosto che inglobare il tutto nella medesima type function, come viene fatto con `ValueRecord`. Bisogna considerare poi che non sempre è possibile usare linearmente quest'ultimo approccio, che risulta parecchio scomodo in certi casi. Che dire infatti se i componenti dell'unione da inglobare non sono `type` o `interface`, ma delle classi? Oppure che fare se, come spesso accade, ogni componente ha diverse proprietà uniche non condivise con gli altri elementi? Siamo costretti ad abusare della type map e, credetemi sulla parola, la situazione degenera velocemente.

&nbsp;

## L'alternativa

Metto le mani avanti, non aspettatevi la rivelazione ultima. Non esiste la panacea a questo delirio, solo strategie per attenuare la situazione che comunque non migliora più di tanto. I miei sforzi si sono concentrati sul mantenere le definizioni dei componenti di `UnionRecord` separate, come è idiomatico fare. Il resto rimane quasi del tutto invariato: non possiamo sbarazzarci né della type map né delle restanti definizioni costruite in funzione di essa.

Iniziamo quindi definendo i tipi dei record:

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;
```

La type map itera `UnionRecord` e associa ad ogni `kind` il record corrispondente:

```ts
// { n: NumberRecord; s: StringRecord; b: BooleanRecord; }
type TypeMap = {
    [K in UnionRecord["kind"]]: Extract<UnionRecord, { kind: K }>; 
};
```

La definizione di `ValueRecord` si complica leggermente. Siamo costretti ad definire manualmente i tipi dei campi `kind` e `v`, sempre in funzione della type map, perché questi due campi sono quelli ai quali funzione `match` accede direttamente. Il tipo `{ kind: P, v: TypeMap[K]["v"] } & Omit<TypeMap[K], "kind" | "v">` è concettualmente identico a `TipeMap[K]`, ma TypeScript si perde all'interno di `match` se usiamo quest'ultimo. Osserviamo che in questo specifico esempio l'intersezione con `Omit<TypeMap[K], "kind" | "v">` potrebbe essere omessa in quanto i record non possiedono altre proprietà oltre a `kind` e `v`.

```ts
type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = { 
    [P in K]: { kind: P, v: TypeMap[K]["v"] } & Omit<TypeMap[K], "kind" | "v">
}[K];
```

Le definizioni delle funzioni e le altre due mappe sono quasi identiche a prima, bisogna solamente allineare il tipo del parametro in `FuncRecord`:

```ts
const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
}

type OutputMap = {
    [K in keyof TypeMap]: ReturnType<(typeof recfs)[K]>
};

type FuncRecord = {
    [P in keyof TypeMap]: (x: TypeMap[P]["v"]) => OutputMap[P];
};
```

La definizione della funzione `match` rimane invariata:
```ts
function match<K extends keyof TypeMap>(
    recv: ValueRecord<K>,
    recfs: FuncRecord
): OutputMap[K] {
    return recfs[recv.kind](recv.v);
}
```

[Link al playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.2.0-beta#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFgyQAVEIBZWzBVUlEoBqgAbQBpKFoocMiCpyamN3wmAF0hxgBRAA9ZWyxgAB4uqKT8DlcNRjbBAD5hKFERURLoADVbKzgIZbm2iCmIOi1KCBAcADMocsgqmpIKZ7ePpVqltantGs0AArtGhQFqjNQDRgQjg+T4Qb6tIZ9TjDIRQABkUAA8ggqPM0Ri4Rx+homFBUkwcVt9pjirgaAYoKhsK9Hi56o0aIwABRCqC8BKoACUxBBMIAVFAAExsAUNLQijVQAxyDIyoggrQAOkMCGFUtV4KQIutvn8+SlPD4aFlUGFSCgAH4oABGKCMAAMUv2h1MxLgwDAEe+tQFrWhTxe7wp1XhmGAcFQNDRc2FpgB3KwvKlmOZByOUAAYnAaFhlrGGk0oR0-knAV9UyKJowU2Am1jGcN9SCiRGo8AMRChmJy68a7NulAELZgFgABbXKC3YD3fCPVsA3tbYUCws+U7nS5ZfDXLaWrk8rXV2vLUSO8OR6PVTFkU8QDNZg+RZaE0Z5GgMQzCmBnBSjOhzLqua7Cms7jMKwKKMAALEqQgcIWxZQAA9IR4rOqgogIeuyHqKhTA6BhzBYFQtg4HSgh4Y+MrEdq6TyBRK5UShmieN4jCvGcWjQOxQEEdxEr8EAA)

&nbsp;

## Conclusione

Esprimere correlazioni tra diverse entità non è mai stato così difficile. Non serve che mi ringraziate.