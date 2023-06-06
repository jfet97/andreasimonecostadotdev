+++
author = "Andrea Simone Costa"
title = "Quando (non) usare i generici"
date = "2023-06-05"
description = "Alcune linee guida per capire quando è il caso di usare i generici"
categories = ["typescript"]
series = ["TypeScript"]
published = false
tags = [
    "generics",
]
featuredImage = "/images/usare_generici/copertina.png"
images = ["/images/usare_generici/copertina.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

## Introduzione

I generici, _type parameter_ per gli amici, sono una delle prime caratteristiche leggermente più astratte che si incrociano quando si utilizza un type system avente una maggiore espressività di quello del linguaggio C. È più che normale, specialmente per chi muove i primi passi, non avere ben chiaro quando è il caso di introdurne uno, o più di uno, e quando no.

In questo articolo affronteremo proprio questo problema. Cercheremo di capire meglio cosa sia un generico e valuteremo assieme alcune linee guida utili che ci possono aiutare a farne un buon uso. E a volte un buon uso corrisponde proprio a nessun uso.

&nbsp;

## Cosa sono i generici

I generici sono variabili che contengono tipi. Siamo abituati a concepire le variabili come una astrazione di una locazione di memoria che conterrà dei valori durante l'esecuzione del programma. Si dà il caso che anche il compilatore sia un programma, il quale durante la fase di type checking inferisce, controlla ed effettua operazioni sui tipi. Un compilatore utilizza svariate strutture dati per rappresentare i tipi e manipolarli.\
I generici ci permettono di chiedere a TypeScript di inferire il tipo di una qualche entità e memorizzare tale tipo in una variabile. Come sia rappresentato internamente il tipo non è di nostro interesse, noi vogliamo solamente averlo a disposizione per riutilizzarlo. Quando ad un generico viene assegnato un tipo si dice che il generico è stato _istanziato_.

L'esempio più semplice che mi viene in mente  per illustrare il concetto sono gli array:
```ts
const arr = [1, "ciao", 2]; //  (string | number)[]

const first = arr.pop(); // string | number | undefined

arr.push(false); // errore: 'false' è un boolean
```
La classe `Array` in TypeScript dichiara un generico per catturare il tipo del contenuto degli array. Quando creiamo un array, ad esempio con le parentesi quadre, stiamo implicitamente chiedendo a TypeScript di inferire il tipo degli elementi che inseriamo in esso e istanziare il generico dichiarato dalla classe `Array` opportunamente per quello specifico array. Nell'esempio il generico viene istanziato col tipo `string | number` per l'array `arr`. In che modo si fa uso del tipo memorizzato nel generico? TypeScript lo utilizza per tipare al meglio le operazioni sull'array, come `push` e `pop`. La `pop` eseguita su `arr` restituisce infatti `string | number | undefined`, mentre la `push` non accetta argomenti aventi tipo differente da `string | number`.

Se il compilatore non disponesse dei generici dovrebbe assegnare il medesimo tipo ad ogni istanza di `Array`, e probabilmente tale tipo sarebbe qualcosa di equivalente ad `unknown[]`. Operazioni di lettura come la `pop` ci costringerebbero di volta in volta ad assertare - sennò poi venite a dirmi che in TypeScript non esistono cast, ma solo type assertion - il tipo del risultato. Operazioni di scrittura come la `push` invece accetterebbero la qualunque, con elevato rischio di inserire negli array valori inaspettati.

Assertare non si può sentire, ne sono consapevole.

&nbsp;

## Quando non usare una variabile

Quando non viene effettivamente utilizzata. Seguono semplici esempi:

```ts
function add(n: number, m: number): number {
  const five = 5; // <- ???

  return n + m;
}
```
```ts
function add(n: number, m: number): number {
  const _n = n; // <- ???

  return n + m;
}
```
```ts
function add(n: number, m: number): number {
  const _n = n; // <- ???
  const _m = m; // <- ???
  const totalSum = _n + _m; // <- ?????

  return n + m;
}
```

&nbsp;

## Quando non usare un generico

Il suggerimento è quello di valutare l'effettivo uso di un generico. Se un generico viene dichiarato e magari anche inizializzato, ma mai realmente utilizzato, nel 99% dei casi può essere omesso.

### Esempio 1

```ts
function len<T>(xs: readonly T[]): number {
  return xs.length;
}
```
Comprendo che la tentazione di flexare un generico sia forte in un caso come questo, ma tutto ciò non è molto diverso dal dichiarare una variabile, assegnare ad essa un valore per poi non usarla mai.\
Il generico `T` lo dichiariamo tra le parentesi angolate e utilizzandolo per tipare il parametro `xs` chiediamo a TypeScript di assegnarvi il tipo degli elementi di `xs` ogniqualvolta la funzione `len` viene invocata. Quello che manca, però, è almeno un utilizzo di tale tipo.

Possiamo riscrivere `len` nel seguente modo, senza utilizzare alcun generico:

```ts
function len(xs: readonly unknown[]): number {
  return xs.length;
}
```

### Esempio 2

```ts
function snd<A, B>(ab: [A, B]): B {
  return ab[1];
}
```
La funzione `snd` estrae il secondo elemento di una tupla. È perfettamente ragionevole voler far inferire a TypeScript il tipo di tale secondo elemento, in modo tale da poterlo restituire aumentando la precisione della segnatura della nostra funzione. Questo è un utilizzo del tipo di tutto rispetto. D'altra parte non vi è necessità di inferire anche il tipo del primo elemento. Il generico `A` verrà istanziato, ma mai utilizzato.

Possiamo riscrivere `snd` nel seguente modo, senza utilizzare il generico `A`:

```ts
function snd<B>(ab: [unknown, B]): B {
  return ab[1];
}
```

### Esempio 3

```ts
function printObjKey<T, K extends keyof T>(obj: T, key: K): void {
  console.log(obj[key]);
}
```

In questo caso stiamo dichiarando due variabili: una utile, l'altra inutile. Il nostro obiettivo è quello di assicurare che la chiave `key` scelta per indicizzare `obj` sia una chiave effettivamente presente in esso. Quindi chiediamo a TypeScript di inferire il tipo di `obj`, salvarlo nella variabile `T` e poi utilizziamo l'operatore `keyof` su `T` per calcolare le effettive chiavi di `obj` e limitare di conseguenza il tipo del secondo argomento `key`. In questo modo stiamo utilizzando `T`, stiamo utilizzando il tipo che sarà memorizzato al suo interno.\
La limitazione del tipo di `key` passa per un'altra variabile, `K`, il cui upper-bound è `keyof T`. Stiamo quindi chiedendo a TypeScript di inferire il tipo del secondo argomento, salvarlo nella variabile `K`, controllare che tale tipo sia assegnabile a `keyof T` e in caso contrario segnalare un errore. Della variabile `K`, però, non ce ne facciamo niente. Non è necessario salvare il tipo del secondo argomento in `K` poiché non vi è alcun utilizzo di tale tipo per altri scopi.

Possiamo riscrivere `printObjKey` nel seguente modo, senza utilizzare il generico `K`:

```ts
function printObjKey<T>(obj: T, key: keyof T): void {
  console.log(obj[key]);
}
```

&nbsp;

## Quando usare un generico

Vediamo ora qualche esempio dove ogni generico viene effettivamente utilizzato e la sua eliminazione peggiorerebbe significativamente la precisione della segnatura della funzione.

### Esempio 1

```ts
function id<const T>(x: T): T {
  return x;
}
```

Per quanto banale, l'identità è un ottimo esempio di un buon uso di un generico. Il generico `T` viene dichiarato, inizializzato durante l'inferenza dell'argomento `x` e utilizzato successivamente come tipo di ritorno della funzione.

### Esempio 2

```ts
function getObjKey<T, K extends keyof T>(obj: T, key: T): T[K] {
  return obj[key];
}
```

A differenza della funzione `printObjKey`, entrambi i generici `T` e `K` hanno ragione di essere dichiarati in `getObjKey` perché entrambi concorrono a definire il tipo del risultato. Vi è quindi almeno un utilizzo della variabile `K`, utilizzo mancante nell'esempio precedente.

### Esempio 3

```ts
function map<T, U>(ts: readonly T[], projection: (t: T) => U): U[] {
  return ts.map(projection);
}
```

Anche in questo esempio dichiariamo due variabili: `T` e `U`. La variabile `T` sarà inizializzata con il tipo degli elementi nell'array `ts` e utilizzata per tipare l'argomento della `projection`. La variabile `U` sarà inizializzata con il tipo di ritorno di questa callback e utilizzata per tipare l'array risultante dalla trasformazione.