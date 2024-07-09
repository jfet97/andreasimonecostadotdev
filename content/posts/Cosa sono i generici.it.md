+++
author = "Andrea Simone Costa"
title = "Cosa sono i generici, per davvero"
date = "2024-07-08"
description = "Cerchiamo di fare chiarezza, una volta per tutte, sulla vera essenza dei generici."
categories = ["typescript"]
series = ["TypeScript"]
published = true
tags = [
    "generics",
]
featuredImage = "/images/usare_generici/copertina_g.png"
images = ["/images/usare_generici/copertina_g.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

## Introduzione

Cosa sono i generici? I generici sono solo delle variabili, semplice semplice. Non a caso ci si può riferire ad essi come _type variable_, o _type parameter_.

## Delle...variabili?

Si! Prendiamo come esempio la seguente definizione di funzione:

```ts
function toPair<X>(x: X): [X, X] {
    return [x, x];
}
```

L'abitudine ci porta a vedere `toPair` come una funzione generica che preso un qualsiasi `x` avente un qualche tipo `X` lo duplica, producendo la coppia `[x, x]` di tipo `[X, X]`. Questo modo di vedere le cose però nasconde, dal mio punto di vista, la vera natura dei generici.

Possiamo infatti essere un pochino più precisi: la funzione `toPair` prende in ingresso una _type variable_ `X` e restituisce una funzione la quale, a sua volta, prende un qualsiasi `x` di tipo `X` e lo duplica, producendo la coppia `[x, x]` di tipo `[X, X]`.

Da un punto di vista __formale__ `toPair` è una funzione leggermente bizzarra poiché prende in input __un tipo__ ma restituisce __un termine__, ovvero un valore effettivamente esistente a runtime (la funzione che duplica `x`). Come possiamo invocare `toPair`? Con le parentesi angolate `<>`:

```ts
const toPairNumber = toPair<number>
// toPairNumber: (x: number) => [number, number]

const toPairString = toPair<string>
// toPairString: (x: string) => [string, string]
```

La prima volta invochiamo `toPair` con il tipo `number` e quindi ci verrà restituita una funzione che prende una variabile `x` di tipo `number` e restituisce una coppia di numeri. In questo caso la _type variable_ `X` sarà pari a `number`. La seconda volta invochiamo `toPair` con il tipo `string` e quindi ci verrà restituita una funzione che prende una variabile `x` di tipo `string` e restituisce una coppia di stringhe. In questo caso la _type variable_ `X` sarà pari a `string`.

Osserviamo quindi che la _type variable_ `X` si sta comportando esattamente come una variabile: nel primo caso `X` avrà come valore il tipo `number`, nel secondo caso `X` avrà come valore il tipo `string`. Per quanto ciò possa suonare poco intuitivo, non vi è realmente nulla di speciale: il compilatore, che ha delle rappresentazioni interne per i tipi `number` e `string`, possiede anche la capacità di rappresentare, con apposite strutture dati, le _type variable_, oltre che associare ad esse sia tipi concreti, come nell'esempio sopra, sia altre _type variable_ in determinate circostanze.

## Il compilato

Poiché TypeScript non esiste a runtime e i motori che eseguono il codice JavaScript non sfruttano in alcun modo le annotazioni di tipo, il codice di cui sopra verrà compilato in qualcosa di simile a:

```js
function toPair(x) {
    return [x, x]
}

const toPairNumber = toPair
const toPairString = toPair
```

Notiamo quindi che il codice JavaScript generato non contiene alcuna traccia della _type variable_ `X` e che le funzioni `toPairNumber` e `toPairString` sono in realtà la stessa funzione `toPair` con un nome diverso. Considerare `toPair` una funzione da tipi a termini (valori) è solo una astrazione, la medesima utilizzata da [System F](https://en.wikipedia.org/wiki/System_F) per descrivere il comportamento di funzioni polimorfe, sebbene dietro le quinte, in JavaScript, essa sia solo una banale funzione da termini a termini.

In altri linguaggi di programmazione le cose potrebbero non stare così: ad esempio in Rust input di tipo diverso potrebbero dare luogo alla generazione e all'invocazione di funzioni diverse poiché la dimensione del [record di attivazione](https://en.wikipedia.org/wiki/Call_stack) di ogni funzione deve essere nota a priori. L'esistenza di termini che dipendono dai tipi è più evidente in questo caso.

## Si, ma l'inferenza?

TypeScript è in grado di inferire il tipo di una _type variable_ in base al tipo dell'argomento passato alla funzione. Ad esempio, il seguente snippet:

```ts
toPair<number>(42) // [42, 42]
```

che racchiude in una sola linea sia l'invocazione di `toPair` con il tipo `number` che l'invocazione della funzione così ottenuta con il valore `42`, può essere riscritto in modo più conciso:

```ts
toPair(42) // [42, 42]
```

poiché il compilatore è in grado di inferire che `X` è pari al tipo `number` in quanto `42` è di tipo `number`.

L'inferenza purtroppo oscura completamente la natura formale della `toPair` e l'associazione necessaria tra la _type variable_ `X` e il tipo concreto `number`, associazione che viene eseguita implicitamente dal compilatore. L'inferenza rende praticamente inutile ragionare sulla `toPair` come una funzione da tipi a termini, poiché il compilatore si occupa di tutto. D'altra parte, l'inferenza è un'arma a doppio taglio quando si prova a comprendere questi concetti: se da un lato ci permette di scrivere codice più conciso, dall'altro ci fa perdere di vista gli elementi in gioco.

## Quando usare i generici?

Ogni volta che si ha bisogno di tenere traccia, nel type system, di un tipo non noto a priori. Le _type variable_ sono variabili e TypeScript le usa per memorizzarvi dei tipi, ma se poi non ne facciamo uso allora risulta inutile averle istanziate. Sono convinto del fatto che capire [quando __non__ usare i generici](/it/posts/quando-non-usare-i-generici/) sia la cosa migliore da fare per imparare a servirsene al meglio.