+++
author = "Andrea Simone Costa"
title = "A tempo di compilazione"
date = "2022-08-21"
description = "Ciò che succede quando un programma scritto in TypeScript viene compilato risulta ancora un mistero per molti; proviamo quindi a fare chiarezza."
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "typescript",
    "compiler",
]
featuredImage = "/images/a_tempo_di_compilazione/compilling.png"
images = ["/images/a_tempo_di_compilazione/compilling.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

## Introduzione

Nella mia limitata esperienza come trainer mi sono reso conto di quanto per molti risulti fumoso e di difficile comprensione ciò che avviene all'atto della compilazione dei nostri sorgenti TypeScript. In particolare mi riferisco alle operazioni possibili nel type system, il quale supporta un linguaggio ad-hoc per descrivere manipolazioni anche piuttosto avanzate dei tipi.

Uno snippet come il seguente è raro che metta in difficoltà qualcuno, a meno di non essere completamente a digiuno di programmazione:
```ts
function isTen(t: number) {
  return t === 10 ? "yes, it is" : "no, it's not"
}
```

Mentre la stessa cosa trasformata in type function sembra essere capace di mettere in crisi un considerevole numero di sviluppatori:
```ts
type IsTen<T extends number> = T extends 10 ? "yes, it is" : "no, it's not"
```

Ciò che prima era un banale algoritmo adesso è diventato magia. Cosa significa codice del genere? Perché possiamo scriverlo? Proviamo a fare un po' luce sulla situazione.

## I type literal

In TypeScript esistono tipi come `"ciao"` o `42`. Essi vengono detti type literal, e se visti come insiemi sono dei [singoletti](https://en.wikipedia.org/wiki/Singleton_(mathematics)). Ad esempio il tipo `42` può essere visto come un insieme contente solo il numero `42`. Ecco come il corpo della type function `IsTen` acquisisce senso: i valori `10`, `"yes, it is"` e `"no, it's not"` hanno un diretto corrispondente nel type system, ed è tale corrispondente ad essere utilizzato nella definizione.

## Il compilatore esegue del codice

Dirò una banalità, ma tutti ci aspettiamo che il codice che scriviamo venga eseguito a  _runtime_. Riempiamo i nostri sorgenti di variabili, classi, metodi e funzioni, per poi darli in pasto all'interprete di turno che avrà il compito di trasformare in azioni le nostre istruzioni.

Forse vi sorprenderà sapere che anche un compilatore potrebbe eseguire parte del nostro codice, e ciò avviene ovviamente a _compile time_. Si tratta di particolari tipi di esecuzione atti a migliorare l'analisi statica dei nostri programmi, come ad esempio l'[esecuzione simbolica](https://en.wikipedia.org/wiki/Symbolic_execution). Lo scopo solitamente è quello di capire se è possibile applicare alcune ottimizzazioni o trasformazioni mantenendo intatta la semantica del programma.

Esiste anche la possibilità di scrivere del codice che verrà eseguito solo a compile time e non a runtime. Un esempio? Le macro del C, le quali vengono analizzate ed eseguite dal pre-processore per produrre altro codice. Un altro esempio? Le type function di TypeScript, le quali sono funzioni che vengono eseguite dal compilatore, e non a runtime, per creare nuovi tipi a partire da tipi già esistenti.

## Esistono due linguaggi

TypeScript è composto essenzialmente da due linguaggi. La separazione non è netta, ma possiamo comunque evidenziare due macroaree: la prima ci permette di scrivere il codice JavaScript con qualche garanzia in più, la seconda è adibita alla creazione e manipolazione dei tipi. La prima produce codice che verrà eseguito a runtime dall'inteprete, la seconda produce codice che verrà eseguito a compile time dal compilatore.

La distinzione che facciamo sul momento in cui il codice viene eseguito o sull'attore che lo esegue non ha alcuna valenza dal punto di vista teorico. Fino a poco tempo fa i due linguaggi erano equipotenti dal punto di vista computazionale: entrambi erano Turing completi. Semplificando, ciò significa che un qualsiasi problema risolubile da un qualsiasi computer poteva essere tranquillamente risolto da un algoritmo scritto in JavaScript o da uno scritto nel type system di TypeScript. Questo è ancora vero per il JavaScript, con o senza tipi, ma non per il type system di TypeScript, che è stato recentemente "depotenziato" (o meglio, è stato depotenziato il type checker che lo esegue).

Prendiamo ad esempio il problema di sommare due numeri interi positivi. Se vi chiedessi di scrivere una funzione che lo risolve probabilmente otterreste una cosa simile alla seguente:
```ts
function sum(a: number, b: number) {
  return a + b
}
```

Possiamo "tranquillamente" fare lo stesso nel type system di TypeScript. Non spaventatevi, non è necessario capire il seguente listato:
```ts
// TS >= 4.8

type NumberToString<N extends number> = `${N}`;

type StringToNumber<SN extends string> = SN extends NumberToString<infer N>
  ? N
  : never;

type NumberToTuple<
  N extends number,
  R extends readonly any[] = []
> = N extends R["length"] ? R : NumberToTuple<N, [...R, any]>;
type TupleToNumber<T extends readonly any[]> = T["length"];

type ConcatTuples<T1 extends readonly any[], T2 extends readonly any[]> = [
  ...T1,
  ...T2
];

type LastChar<
  S extends string,
  BEF extends string = ""
> = S extends `${infer FIRST}${infer REST}`
  ? REST extends ""
  ? [BEF, FIRST]
  : LastChar<REST, `${BEF}${FIRST}`>
  : never;

type Cast<X, Y> = X extends Y ? X : Y;

type SumDigits<
  D1 extends string,
  D2 extends string,
  Carry extends string = "0"
> = NumberToString<
  Cast<
    TupleToNumber<
      ConcatTuples<
        ConcatTuples<
          NumberToTuple<StringToNumber<D1>>,
          NumberToTuple<StringToNumber<D2>>
        >,
        NumberToTuple<StringToNumber<Carry>>
      >
    >,
    number
  >
>;

type TensAndUnits<S extends string> = S extends `${infer FIRST}${infer REST}`
  ? REST extends ""
  ? ["0", FIRST]
  : [FIRST, REST]
  : never;

type TupleToString<
  T extends readonly string[],
  R extends string = ""
> = T extends readonly []
  ? R
  : T extends readonly [infer FIRST extends string, ...infer REST extends readonly string[]]
  ? TupleToString<REST, `${R}${FIRST}`>
  : never;

namespace Sum {
  type __Sum<
    S extends [string, string],
    LCN0 extends string,
    LCM0 extends string,
    R extends readonly any[] = []
  > = _Sum<LCN0, LCM0, [S[1], ...R], S[0]>;

  type _Sum<
    N extends string,
    M extends string,
    R extends readonly any[] = [],
    Carry extends string = "0",
    LCN extends LastChar<N> = LastChar<N>,
    LCM extends LastChar<M> = LastChar<M>
  > = N extends ""
    ? M extends ""
    ? Carry extends "0"
    ? StringToNumber<TupleToString<R>>
    : StringToNumber<TupleToString<[Carry, ...R]>>
    : __Sum<TensAndUnits<SumDigits<"0", LCM[1], Carry>>, "", LCM[0], R>
    : M extends ""
    ? __Sum<TensAndUnits<SumDigits<LCN[1], "0", Carry>>, LCN[0], "", R>
    : __Sum<TensAndUnits<SumDigits<LCN[1], LCM[1], Carry>>, LCN[0], LCM[0], R>;

  export type SumNumbers<N extends number, M extends number> = _Sum<
    NumberToString<N>,
    NumberToString<M>
  >;
}
```

Nel primo caso la funzione `sum` verrà eseguita a runtime dall'interprete di turno, perciò i valori delle variabili `a` e `b` dovranno obbligatoriamente essere noti a runtime, anche se potrebbero già essere noti prima a seconda del modo in cui invochiamo la `sum`:

```ts
sum(10, +prompt())
```

Nel secondo caso la funzione `SumNumbers` verrà eseguita a compile time da TypeScript, perciò i valori delle variabili `N` e `M` dovranno essere obbligatoriamente noti a compile time:

```ts
type Dodici = Sum.SumNumbers<4, 8> // 12
```

La definizione di `SumNumbers` è molto più complessa della `sum` e nessuno si sognerebbe mai di voler programmare applicazioni reali in un linguaggio che richiede così tanti sforzi anche solo per le cose più semplici. Ciò che sto cercando di trasmettere con questo esempio è la consapevolezza del fatto che non sta accadendo nulla di strano: abbiamo scritto un algoritmo che viene eseguito dal compilatore anziché dall'interprete.

Risulta poi che gli esiti di queste computazioni a tempo di compilazione vengono considerati dal compilatore i tipi delle entità che esistono a runtime, ma da un punto di vista teorico non siamo obbligati a fare questa associazione. Un esempio lampante è [HypeScript](https://github.com/ronami/HypeScript), nel quale viene utilizzato esclusivamente il type system del linguaggio per il parsing e il type checking di programmi TypeScript. Potremmo addirittura riuscire a far eseguire alcuni programmi JavaScript, che generalmente dovrebbero girare a runtime, dal compilatore invece, considerando i valori restituiti dalle varie type function non più come tipi ma, appunto, come i valori che sarebbero dovuti esistere a runtime.

Ovviamente questi utilizzi esotici del type system non hanno alcuna valenza pratica, se non quella di chiarire (confondere) la natura dei concetti in gioco. L'unico scopo effettivo degli algoritmi scritti nel type system rimane quello di creare e manipolare tipi che siano utili nella verifica della correttezza dei nostri programmi.

## Gli errori

Quando scriviamo del codice possiamo, generalmente, evidenziare una situazione di errore ad esempio lanciando una eccezione. Un altro pattern, o meglio anti-pattern, è quello di restituire `null` o `undefined` quando il risultato di una operazione non è definito, o comunque quando qualcosa è andato storto.

Non possiamo lanciare eccezioni nel type system, non direttamente almeno, perciò segnalare un errore durante l'esecuzione di una type function, o un suo uso errato, è meno banale del previsto.

Utilizzare un upper bound nella dichiarazione di un type parameter ha come conseguenza automatica la generazione di un errore a tempo di compilazione nel qual caso il tipo concreto non rispetti il bound:

```ts
type IsTen<T extends number> = T extends 10 ? "yes, it is" : "no, it's not"

type T0 = IsTen<["ciao"]> // Type '["ciao"]' does not satisfy the constraint 'number'.
```

Questo è praticamente l'unico modo per segnalare in modo evidente un errore, e purtroppo è piuttosto limitato. Per poter codificare un comportamento come il seguente:

```ts
type TenIsForbidden<T> = T extends 10 ? throw "please, not the ten" : T
```

abbiamo bisogno di una sana dose di inventiva e di qualche trick meno noto, sui quali magari scriverò un articolo in futuro:

```ts
type Id<T> = T extends unknown ? T : never
type TenIsForbidden<T extends TenIsForbidden<T>> = Id<T> extends 10 ? "please, not the ten" : Id<T>

type T1 = TenIsForbidden<15> // 15
type T2 = TenIsForbidden<10> // Type '10' does not satisfy the constraint '"please, not the ten"'
```

È comune quindi sfruttare il tipo `never`, che personalmente chiamo "il `null` del type system", restituendolo ogniqualvolta qualcosa non va:

```ts
type TenIsForbidden<T> = T extends 10 ? never : T

type Pop<T extends readonly any[]> = T extends [...infer REST, any] ? REST : never
```

La ratio sta nel fatto che non esistono valori aventi tipo `never`, quindi se il tipo risultante da una computazione nel type system fosse proprio esso molto probabilmente incontreremmo, in un secondo momento, alcuni problemi nella compilazione del nostro codice.

Questo approccio ha ovviamente dei contro. Innanzitutto viene oscurata la causa originale del problema: di per se il tipo `never` non aiuta a comprendere la reale natura dell'errore. Oltre a ciò `never` è sottotipo di qualunque altro tipo, quindi componendo più type function potremmo ritrovarci davanti a risultati davvero inaspettati dato che tutti i check fatti con gli `extends` hanno esito positivo.