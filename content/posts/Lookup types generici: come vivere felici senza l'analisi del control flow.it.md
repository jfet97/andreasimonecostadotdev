+++
author = "Andrea Simone Costa"
title = "Lookup types generici: come vivere felici senza l'analisi del control flow"
date = "2022-04-06"
description = "Come risolvere la mancanza di analisi del control flow quando si deve generare un valore il cui tipo è un lookup type generico"
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "types",
    "generics",
    "control flow analysis",
]
featuredImage = "/images/lookup-generici/generic_lookup.png"
images = ["/images/lookup-generici/generic_lookup.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

## Introduzione

La capacità di TypeScript di rifinire un tipo analizzando il control flow del codice è una delle feature più comode e utilizzate del linguaggio. Vediamo un semplice esempio per chiarire di che cosa si tratta:

```ts
function foo(x: string | number) {
  if(typeof x === "string") {
    console.log(x.repeat(x.length));
  } else {
    console.log(Math.sqrt(x));
  }
}
```

TypeScript è in grado di comprendere che se la condizione del costrutto `if` è verificata il tipo di `x` può essere correttamente "ristretto" al solo `string`: ecco che diventa possibile accedere al metodo `repeat` e alla proprietà `length` della stringa. Ciò ha come immediata conseguenza il fatto che nel ramo `else` la variabile `x` può solamente essere un `number`, quindi è possibile darlo in input a una delle utils esposte da `Math`.

## Il problema

TypeScript non supporta il narrowing di un type parameter `T` in base, ad esempio, al valore contenuto in una variabile avente quel tipo. In altre parole l'analisi del control flow va quasi completamente a farsi benedire. Non dal papa, da Hejlsberg in persona. Questo perché è facilissimo ricadere in una situazione nella quale tale narrowing sarebbe scorretto, o _unsound_, come dicono gli inglesi.

Ecco che incontriamo dei problemi in situazioni come la seguente:

```ts
interface Payloads {
  auth: {
    username: string;
    password: string;
  };
  cart: {
    items: { id: string; quantity: number }[];
    price: number;
    appliedCoupon?: string;
  };
  room: {
    id: string;
    name: string;
    partecipants: { username: string }[];
  };
}

function createPayload<K extends keyof Payloads>(service: K): Payloads[K] {
  switch (service) {
    case "auth":
      return { 
        username: "johndoe",
        password: "eodnhoj",
      };
    case "cart":
      return { 
        items: [],
        price: 0,
      };
    case "room":
      return {
        id: "123",
        name: "kitchen",
        partecipants: [{ username: "johndoe" }],
      };
  }
}
```

[Playground](https://www.typescriptlang.org/play/?target=99&jsx=0&ts=5.5.3#code/JYOwLgpgTgZghgYwgAgApwJ4BsD2cAmAzsgN4BQyycArmABYBcpFly1h0IcAthE4WCigA5gG4WlAA5xChAO44o+foJHjKAX3XIEcKGCblWyYJG6FDJ5cgFCQY5AEdqccKYxMQ1bgCNoyDQBtAF1tKSEkT28-KDCqSUksYAh8AGEcakkcEAB+FTsxFi0WKBwcbkMJK3y1Kq5eGvs46X0IBGBpcAtSNg4oer4bVXsAkO1ijTIyGGoQBDBgbJ0oCDhIdGw8fAAeAGlkCAAPSBAiZABrCAwcGDRMXAJCAD4ACj6AN2BI5F2ASiYNg8iIFdsFmJR5KYEHRkG9oJ8kL9waxdBxkAAiGj0dEMKqUFZgaj9HrsTg8QbogBWODopxwEHRABpkNJZAolEx0RAcPgQHQcJT0QE4qiUOjdPocXjkASiSAeqYIOYmCFmZIIoMAAzCqqijGlcpS4z4iCE4lGY2UYDWdEARgATABmJnSygDTnnKF0CAgF2WqR6SDtTpgbqBEi9MkNDHU2n4elCjTBRnS4qaMiTIA)

La funzione `createPayload` evidentemente copre ogni caso restituendo di volta in volta il payload corretto, eppure TypeScript (`v. 5.5.3`) non è d'accordo e ci segnala due diverse tipologie di errore.

La prima riguarda il tipo di ritorno della funzione: "_Function lacks ending return statement and return type does not include 'undefined'._". In altre parole TypeScript non considera esaustivo lo `switch`/`case` e si aspetta quindi che venga gestito nel codice anche il `default` case, sebbene non potrà mai accadere che ll parametro `service` risulti diverso dai valori `"auth"`, `"cart"` e `"room"`.

Possiamo facilmente risolvere l'errore nel seguente modo:

```ts
function createPayload<K extends keyof Payloads>(service: K): Payloads[K] {
  switch (service) {
    case "auth":
      return { 
        username: "johndoe",
        password: "eodnhoj",
      };
    case "cart":
      return { 
        items: [],
        price: 0,
      };
    case "room":
      return {
        id: "123",
        name: "kitchen",
        partecipants: [{ username: "johndoe" }],
      };
    default:
      throw new Error("undefined service");
  }
}
```

[Playground](https://www.typescriptlang.org/play/?target=99&jsx=0&ts=5.5.3#code/JYOwLgpgTgZghgYwgAgApwJ4BsD2cAmAzsgN4BQyycArmABYBcpFly1h0IcAthE4WCigA5gG4WlAA5xChAO44o+foJHjKAX3XIEcKGCblWyYJG6FDJ5cgFCQY5AEdqccKYxMQ1bgCNoyDQBtAF1tKSEkT28-KDCqSUksYAh8AGEcakkcEAB+FTsxFi0WKBwcbkMJK3y1Kq5eGvs46X0IBGBpcAtSNg4oer4bVXsAkO1ijTIyGGoQBDBgbJ0oCDhIdGw8fAAeAGlkCAAPSBAiZABrCAwcGDRMXAJCAD4ACj6AN2BI5F2ASiYNg8iIFdsFmJR5KYEHRkG9oJ8kL9waxdBxkAAiGj0dEMKqUFZgaj9HrsTg8QbogBWODopxwEHRABpkNJZAolEx0RAcPgQHQcJT0QE4qiUOjdPocXjkASiSAeqYIOYmCFmZIIoMAAzCqqijGlcpS4z4iCE4lGY2UYDWdEARgATABmJnSygDTnnKF0CAgF2WqR6SDtTpgbqBEi9MkNDHU2n4elCjTBRnS4rGfAQeDULAGaX0UpyZAgCCFgCiUFKUBe6NmGZgoBSNnhXwZv3GZEmQA)

Il secondo tipo di errore invece risulta molto più prolisso e oscuro, e intacca ogni ramo dello `switch`. TypeScript ci dice che ogni valore restituito "_is not assignable to type 'Payloads[K]'_", in particolare ci dice che non è assegnabile al tipo:

```ts
{
  username: string;
  password: string;
} & {
  items: { id: string; quantity: number }[];
  price: number;
  appliedCoupon?: string | undefined;
} & {
  id: string;
  name: string;
  partecipants: { username: string }[];
};
```

Perché? Da dove saltano fuori quelle intersezioni? Cerchiamo di capire meglio cosa succede.

Abbiamo detto che TypeScript non supporta l'analisi del control flow per rifinire un tipo parametrico, e `K` è proprio questo! TypeScript sa che `service` può essere ristretta, ad esempio, al solo caso `"auth'`, perciò ci permette di creare uno `switch`/`case` come quello presente in `createPayload`, ma non rifinisce di conseguenza anche il type parameter `K`. TypeScript non sa che `{ username: "johndoe", password: "eodnhoj" }` è assegnabile a `Payloads[K]` in quella specifica circostanza poiché non tiene conto dell'uguaglianza `K = "auth"`.

TypeScript è essenzialmente fin troppo cauto, e ci richiede di restituire un valore che per ogni possibile `K` è assegnabile a `Payloads[K]`. Tale valore dovrà quindi contenere ogni possibile proprietà disponibile accedendo ad una qualsiasi chiave di un oggetto `Payloads`, perciò il suo tipo non può che essere l'intersezione tra tutti i vari tipi delle chiavi presenti in `Payloads`. Nessun ramo dello `switch`/`case` restituisce un valore di tale tipo, quindi TypeScript protesta in ognuno di essi.

## La soluzione

Come possiamo creare un valore di tipo `Payloads[K]` in modo pulito? Siamo costretti a restituire sempre un mappazzone con millemila proprietà? Per fortuna no!

Ragioniamo sul significato di tale tipo: esso deriva dall'accedere ad un oggetto di tipo `Payloads` con una chiave generica `K`, chiave che deve essere assegnabile a `keyof Payloads`. Abbiamo una chiave di tipo `K`? Si, è proprio il parametro `service`! Ci manca giusto l'oggetto `Payloads`:

```ts
function createPayload<K extends keyof Payloads>(service: K): Payloads[K] {
  const payloads = {
    auth: {
      username: "johndoe",
      password: "eodnhoj",
    },
    cart: {
      items: [],
      price: 0,
    },
    room: {
      id: "123",
      name: "kitchen",
      partecipants: [{ username: "johndoe" }],
    },
  } satisfies Payloads;

  return payloads[service];
}
```

[Playground](https://www.typescriptlang.org/play/?target=99&jsx=0&ts=5.5.3#code/JYOwLgpgTgZghgYwgAgApwJ4BsD2cAmAzsgN4BQyycArmABYBcpFly1h0IcAthE4WCigA5gG4WlAA5xChAO44o+foJHjKAX3XIEcKGCblWyYJG6FDJ5cgFCQY5AEdqccKYxMQ1bgCNoyDQBtAF1tKSEkT28-KDCqSUksYAh8AGEcakkcEAB+FTsxFi0WKBwcbkMJK3y1Kq5eGvs46X0IBGBpcAtSNg4oer4bVXsAkO1ijTIyGGoQBDBgbJ0oCDhIdGw8fAAeAGlkCAAPSBAiZABrCAwcGDRMXAJCAD4ACj6AN2BI5F2ASiYNg8iIFdsFmJQENkBMhpJtHsgALzg1g0eiVYyUdicHiDABEACscHRTjgILiADRVKQyeSKay4iA4fAgOg4fEUqoaSnGXT6dEY0wQcxMELcjGSCKDAAMYs0suQpXK-OMwHpAEYAEwAZg5GOQAyYuPOpgQdAgIF14r0kHanTA3UCJF62IayAJRJJZICwXlXKKNjWwEIMGSxEBW0I4hKEDA1H6MPuEcCHy+EFCZEmQA)

Ecco che TypeScript è pienamente soddisfatto perché stiamo restituendo esattamente il `Payloads[K]` richiesto. Oltre a ciò non è nemmeno più necessario gestire inutilmente un `default` case sporcando il nostro codice.

## La soluzione efficiente

La soluzione appena proposta è sicuramente corretta, ma non è la più efficiente. Ogni volta che chiamiamo `createPayload` stiamo creando un oggetto `Payloads` completo, anche se ci serve solamente una piccola parte di esso. Questo diventa un problema se `Payloads` fosse un oggetto molto grande e complesso e la funzione `createPayload` venisse chiamata con una certa frequenza.

Per risolvere questo problema possiamo sfruttare i getters:

```ts
function createPayload<K extends keyof Payloads>(service: K): Payloads[K] {
  const payloads = {
    get auth() {
      return {
        username: "johndoe",
        password: "eodnhoj",
      }
    },
    get cart() {
      return {
        items: [],
        price: 0,
      }
    },
    get room() {
      return {
        id: "123",
        name: "kitchen",
        partecipants: [{ username: "johndoe" }],
      }
    },
  } satisfies Payloads;

  return payloads[service];
}
```

[Playground](https://www.typescriptlang.org/play/?target=99&jsx=0&ts=5.5.3&ssl=42&ssc=2&pln=18&pc=1#code/JYOwLgpgTgZghgYwgAgApwJ4BsD2cAmAzsgN4BQyycArmABYBcpFly1h0IcAthE4WCigA5gG4WlAA5xChAO44o+foJHjKAX3XIEcKGCblWyYJG6FDJ5cgFCQY5AEdqccKYxMQ1bgCNoyDQBtAF1tKSEkT28-KDCqSUksYAh8AGEcakkcEAB+FTsxFi0WKBwcbkMJK3y1Kq5eGvs46X0IBGBpcAtSNg4oer4bVXsAkO1ijTIyGGoQBDBgbJ0oCDhIdGw8fAAeAGlkCAAPSBAiZABrCAwcGDRMXAJCAD4ACj6AN2BI5F2ASiYNg8iIFdsFmJQENkBMhpJtHsgALzg1jCCBgKi0OgvX7I4wrMDUfq44y9Tg8QYAIgAVjg6KccBAKQAaKrGaSyBRKJgUiA4fAgOg4KnM1kBKoaFnGVHo3T6bHEyj4wkgBWsUwQcxMEKSknhL6DAAMOuMkxNxuQ0uQpXK8qMJKVRLtuuA1gpAEYAEwAZhFusoA2551MCDoEBAvr9LUg7U6YG6gRIpP65O5NLp+AZFICwXNmnFOo0NjWwEIMGSxEBW0I4hKaOVMPuVcCH31oTIkyAA)
