+++
author = "Andrea Simone Costa"
title = "Awaited: quando l'await raggiunge il type level"
date = "2022-04-28"
description = "Diamo un'occhiata all'implementazione della type function Awaited disponibile da TS 4.5"
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "types",
    "await",
    "promises",
]
featuredImage = "/images/awaited/copertina.png"
images = ["/images/awaited/copertina.png"]
+++

# Awaited<T>

## Introduzione

La versione 4.5 di TypeScript ha introdotto la type function `Awaited`. Il suo scopo è quello di aiutarci a modellare meglio tutte quelle situazioni in cui è implicato un `await`, o comunque il metodo `then` delle promise. La situazione è meno banale di quanto si potrebbe pensare, in quanto il JavaScript "unwrappa" automaticamente eventuali promise innestate, una espressione come `await 42` è perfettamente lecita e vi è il supporto ai thenable, ovvero plain objects che dichiarano il metodo `then`.

Ecco che la type function `Awaited` è lo strumento adeguato per tutte queste casistiche:

```ts
type test1 = Awaited<42> // 42
type test2 = Awaited<Promise<number>> // number
type test3 = Awaited<Promise<Promise<string>>> // string
type test4 = Awaited<{ then: (onfulfilled: (v: string[]) => void) => void }> // string[]
```
[Playground](https://www.typescriptlang.org/play?jsx=0#code/C4TwDgpgBMEM7AIxQLxQIIHcCGBLWAJgDwAsATAHxQD01U5AUKJDPMGahjvhMQAoAnAPYBbXHAhEAdgFcRAIwgCKVWlFkKlTcNFgIAzJyx5CRQaPGTzYiUQQDcUgOYrVde46faWe4CSPcpgDeMAAWEFIAXFAAFEJSAGYyADYJuMnJvNExAG7RHs4A2gC6AJSoVDlCuATlKJXVBFAAvm5QBU4lQA)

## Gli internals

La definizione di `Awaited` è la seguente:

```ts
type Awaited<T> =
    T extends null | undefined ? T :
        T extends object & { then(onfulfilled: infer F): any } ? 
            F extends ((value: infer V, ...args: any) => any) ? 
                Awaited<V> :
                never :
        T;
```

Il primo controllo che viene eseguito riguarda i tipi `null` e `undefined`: se il flag `--strictNullChecks` non fosse attivo allora entrambi sarebbero sottotipi di qualunque tipo, e ciò causerebbe problemi negli step successivi. In particolare, il tipo risultante sarebbe `never` anziché `null` oppure `undefined`.

In secondo luogo si controlla se il tipo `T` non è un primitivo ed è un thenable, e ricordiamo che le promise stesse sono dei thenable. Per essere un thenable il metodo `then` deve dichiarare un parametro, `onfulfilled`, il quale deve essere una callback da invocare con un qualsiasi valore, `value`. Tale valore è a tutti gli effetti il valore di completamento del thenable. La keyword `infer` permette prima di estrarre il tipo di `onfulfilled` e poi quello di `value`, il quale verrà "unwrappato" ricorsivamente.

Quali sono i casi base della ricorsione? Il primo, `null | undefined`, l'abbiamo già discusso. Inoltre, se il tipo `T` corrisponde ad un tipo primitivo o a un oggetto che non è un thenable, tale tipo `T` verrà direttamente restituito. Infine, se il tipo `T` corrisponde ad un thenable il cui parametro non è invocabile abbiamo a che fare con un thenable che non si completerà mai, quindi il giusto tipo risultante è `never`.

## Promise.all

Un caso d'uso della type function `Awaited` è il metodo statico `all` della classe `Promise`:

```ts
interface PromiseConstructor {
  all<T extends readonly unknown[] | []>(values: T): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
}
```

L'array o la tupla presi come input possono contenere, da specifica, qualunque valore. Il risultato sarà una promise contenente un array, o una tupla, mutabile dove il tipo di ogni cella è pari al tipo della corrispondente cella dell'input dato in pasto proprio alla `Awaited`.